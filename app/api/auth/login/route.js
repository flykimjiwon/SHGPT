import { getMongoClient } from '@/lib/mongo';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

export async function POST(request) {
  const { email, password } = await request.json();
  const client = await getMongoClient();

  const user = await client.db('gpt')
    .collection('users')
    .findOne({ email });

  if (!user) {
    return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
      status: 401,
    });
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
      status: 401,
    });
  }

  // JWT 발급 (비밀키는 .env 에 보관)
  const token = jwt.sign(
    { sub: user._id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  return new Response(JSON.stringify({ token }), { status: 200 });
}