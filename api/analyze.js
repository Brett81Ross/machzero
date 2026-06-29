export default function handler(req, res) {
  // Securely passes the existing Vercel environment key to your frontend
  // without creating any new files in your repository structure
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY environment variable is not configured on Vercel.' });
  }
  return res.status(200).json({ key: process.env.GEMINI_API_KEY });
}
