import { handleOnlyMonsterInspector } from '../../../lib/server/onlymonster/client';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const result = handleOnlyMonsterInspector();
  return res.status(result.statusCode).json(result.body);
}
