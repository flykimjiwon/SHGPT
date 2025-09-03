import jwt from 'jsonwebtoken';

/**
 * Authorization 헤더에 들어있는 Bearer 토큰을 검증하고,
 * 유효하면 payload(디코딩된 토큰) 를 반환, 아니면 null.
 */
export function verifyToken(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // 토큰을 디코딩하고 email, sub(기존 userId), _id 정보를 추출하여 사용한다.
    return { ...payload, id: payload.sub };
  } catch {
    return null;
  }
}