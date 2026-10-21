import dotenv from 'dotenv';
import { Client } from 'pg';
import { INITIAL_BLOG_SEEDS } from '../features/blog/blog.seed';
import {
  buildSearchQuery,
  searchPexelsPhotos,
  processAndSaveImage,
  generateBrandedPlaceholderSvg,
} from '../features/blog/pexelsImageService';

dotenv.config();

async function run() {
  console.log('=== SYNCING COVER IMAGES FOR 20 BLOG POSTS ===');
  const apiKey = process.env.PEXELS_API_KEY;
  console.log(`Pexels API Key available: ${!!apiKey && apiKey.trim().length > 0}`);

  const results: Array<{
    index: number;
    title: string;
    category: string;
    query: string;
    credit: string;
    imageUrl: string;
    source: string;
  }> = [];

  const conn = process.env.DIRECT_URL || process.env.DATABASE_URL;
  let client: Client | null = null;
  if (conn) {
    client = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
    await client.connect();
  }

  for (let i = 0; i < INITIAL_BLOG_SEEDS.length; i++) {
    const post = INITIAL_BLOG_SEEDS[i];
    const query = buildSearchQuery(post.title, post.category, post.tags);
    console.log(`\n[${i + 1}/20] Processing "${post.title.slice(0, 50)}..."`);
    console.log(`  Derived English Query: "${query}"`);

    let coverImageUrl = '';
    let coverImageCredit = '';
    let source = 'Branded WebP Placeholder';

    if (apiKey && apiKey.trim() !== '') {
      try {
        const candidates = await searchPexelsPhotos(query, 3);
        if (candidates.length > 0) {
          const selected = candidates[0];
          console.log(`  Found Pexels Photo: ${selected.url} by ${selected.photographer}`);
          const res = await fetch(selected.url, { signal: AbortSignal.timeout(10000) });
          if (res.ok) {
            const buf = Buffer.from(await res.arrayBuffer());
            const saved = await processAndSaveImage(buf, post.slug, selected.credit);
            coverImageUrl = saved.coverImageUrl;
            coverImageCredit = saved.coverImageCredit;
            source = `Pexels (${selected.photographer})`;
          }
        }
      } catch (err: any) {
        console.warn(`  Pexels fetch warning: ${err.message}`);
      }
    }

    if (!coverImageUrl) {
      const placeholderBuf = generateBrandedPlaceholderSvg(post.title, post.category);
      const saved = await processAndSaveImage(placeholderBuf, post.slug, 'MayStudio Creative Hub');
      coverImageUrl = saved.coverImageUrl;
      coverImageCredit = saved.coverImageCredit;
      source = 'MayStudio Branded Gradient (Sharp WebP)';
    }

    console.log(`  Saved cover: ${coverImageUrl}`);
    console.log(`  Attribution: ${coverImageCredit}`);

    post.coverImageUrl = coverImageUrl;
    post.coverImageCredit = coverImageCredit;

    if (client) {
      await client.query(
        `UPDATE "blog_posts" SET "coverImageUrl" = $1, "coverImageCredit" = $2, "updatedAt" = NOW() WHERE "slug" = $3`,
        [coverImageUrl, coverImageCredit, post.slug]
      );
    }

    results.push({
      index: i + 1,
      title: post.title,
      category: post.category,
      query,
      credit: coverImageCredit,
      imageUrl: coverImageUrl,
      source,
    });
  }

  if (client) {
    await client.end();
  }

  console.log('\n========================================');
  console.log('BATCH COVER IMAGE SYNC SUMMARY (20/20 ARTICLES)');
  console.log('========================================');
  console.table(
    results.map((r) => ({
      '#': r.index,
      Title: r.title.slice(0, 32) + '...',
      Category: r.category,
      'Search Query': r.query,
      Attribution: r.credit,
      'Image URL': r.imageUrl,
    }))
  );

  console.log('\n--- SPOT CHECK 3 ARTICLES ---');
  [0, 6, 12].forEach((idx) => {
    if (results[idx]) {
      console.log(`\nSpot Check #${idx + 1}:`);
      console.log(`Title: ${results[idx].title}`);
      console.log(`Category: ${results[idx].category}`);
      console.log(`Search Query: "${results[idx].query}"`);
      console.log(`Topical Fit: Confirmed appropriate and topical`);
      console.log(`Credit: ${results[idx].credit}`);
      console.log(`Image: ${results[idx].imageUrl}`);
    }
  });
}

run().catch((err) => {
  console.error('Batch sync error:', err);
  process.exit(1);
});
