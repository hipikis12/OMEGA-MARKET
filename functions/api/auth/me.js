import { json } from '../../../lib/http.js';
import { getSession, publicUser } from '../../../lib/auth.js';

export async function onRequestGet(context) {
  return json({ user: publicUser(await getSession(context)) });
}
