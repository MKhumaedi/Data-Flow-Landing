export interface CVMatchRequest {
  cvData: {
    personalInfo?: {
      fullName?: string;
      jobTitle?: string;
      email?: string;
      phone?: string;
      location?: string;
    };
    summary?: string;
    experiences?: Array<{
      company?: string;
      position?: string;
      period?: string;
      highlights?: string[];
    }>;
    educations?: Array<{
      institution?: string;
      degree?: string;
    }>;
    skills?: string[];
    certifications?: Array<{
      name?: string;
      issuer?: string;
    }>;
    languages?: Array<{
      language?: string;
      level?: string;
    }>;
  };
  jobDescription: string;
}

export interface CVMatchResult {
  matchScore: number;
  matchedSkills: string[];
  suggestedSkills: string[];
  feedback: string;
}

export interface CVQuotaInfo {
  used: number;
  limit: number;
  remaining: number;
  isPremium: boolean;
}
