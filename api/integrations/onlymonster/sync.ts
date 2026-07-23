import { handleOnlyMonsterSync } from '../../../lib/server/onlymonster/client';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const body = req.body || {};
  const result = await handleOnlyMonsterSync(body);
  return res.status(result.statusCode).json(result.body);
}
