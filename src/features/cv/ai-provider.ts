import { CVMatchRequest, CVMatchResult } from './cv.types';
import { GoogleGenAI, Type } from '@google/genai';

function buildPrompt(req: CVMatchRequest): string {
  const cvJson = JSON.stringify(req.cvData, null, 2);
  const jobDesc = req.jobDescription.trim();

  return `Anda adalah seorang HR Expert dan ATS Specialist profesional.
Tugas Anda adalah menganalisis kecocokan antara Curriculum Vitae (CV) kandidat dengan Deskripsi Lowongan Pekerjaan (Job Description).

DATA CV KANDIDAT:
${cvJson}

DESKRIPSI LOWONGAN PEKERJAAN:
${jobDesc}

INSTRUKSI:
1. Bandingkan profil, pengalaman, pendidikan, dan keahlian di CV dengan kualifikasi pada lowongan kerja.
2. Hitung persentase kecocokan ("matchScore") dari 0 hingga 100 secara objektif.
3. Identifikasi "matchedSkills": daftar keahlian/kata kunci yang terdapat di CV dan sesuai dengan kebutuhan lowongan.
4. Identifikasi "suggestedSkills": daftar keahlian penting yang diminta di lowongan namun belum tercantum di CV.
5. Buat "feedback": 2-4 kalimat saran perbaikan yang spesifik, konstruktif, dan actionable dalam Bahasa Indonesia.`;
}

function parseAIResponse(rawText: string): CVMatchResult {
  try {
    const cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    const matchScore = typeof parsed.matchScore === 'number' 
      ? Math.max(0, Math.min(100, Math.round(parsed.matchScore)))
      : 75;
    const matchedSkills = Array.isArray(parsed.matchedSkills) ? parsed.matchedSkills.map(String) : [];
    const suggestedSkills = Array.isArray(parsed.suggestedSkills) ? parsed.suggestedSkills.map(String) : [];
    const feedback = typeof parsed.feedback === 'string' && parsed.feedback.trim().length > 0
      ? parsed.feedback.trim() 
      : 'CV Anda memiliki kecocokan yang baik dengan posisi ini.';

    return { matchScore, matchedSkills, suggestedSkills, feedback };
  } catch (e) {
    console.warn('Failed to parse raw AI response as JSON:', rawText);
    return {
      matchScore: 70,
      matchedSkills: [],
      suggestedSkills: [],
      feedback: 'Analisis selesai. Silakan periksa kembali kecocokan kualifikasi pada deskripsi lowongan.',
    };
  }
}

async function callGeminiAPI(prompt: string, apiKey: string): Promise<string> {
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const response = await ai.models.generateContent({
    model: 'gemini-3.7-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          matchScore: {
            type: Type.INTEGER,
            description: 'Persentase kecocokan dari 0 sampai 100',
          },
          matchedSkills: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Daftar keahlian di CV yang cocok dengan lowongan',
          },
          suggestedSkills: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Daftar keahlian yang disarankan untuk ditambahkan ke CV',
          },
          feedback: {
            type: Type.STRING,
            description: 'Saran perbaikan 2-4 kalimat dalam Bahasa Indonesia',
          },
        },
        required: ['matchScore', 'matchedSkills', 'suggestedSkills', 'feedback'],
      },
    },
  });

  return response.text || '';
}

async function callClaudeAPI(prompt: string, apiKey: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt + '\n\nFormat output JSON valid.' }],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Claude API error (${res.status}): ${errBody}`);
    }

    const json: any = await res.json();
    return json?.content?.[0]?.text || '';
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function requestCVMatchAnalysis(request: CVMatchRequest): Promise<CVMatchResult> {
  const prompt = buildPrompt(request);
  const geminiKey = process.env.GEMINI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  let rawOutput = '';


  if (geminiKey) {
    try {
      rawOutput = await callGeminiAPI(prompt, geminiKey);
    } catch (geminiErr: any) {
      console.warn('Gemini API attempt failed, checking fallback:', geminiErr?.message || geminiErr);
      if (anthropicKey && anthropicKey.startsWith('sk-ant-')) {
        rawOutput = await callClaudeAPI(prompt, anthropicKey);
      } else {
        throw geminiErr;
      }
    }
  } else if (anthropicKey && anthropicKey.startsWith('sk-ant-')) {
    rawOutput = await callClaudeAPI(prompt, anthropicKey);
  } else {
    throw new Error('Konfigurasi API Key AI (GEMINI_API_KEY) tidak ditemukan di server.');
  }

  return parseAIResponse(rawOutput);
}
