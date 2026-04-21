// 관리자 전용 API - 구독 코드 생성 및 검증
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'saju2024admin';

// 간단한 코드 저장소 (Vercel Edge Config 대신 메모리 사용)
// 실제로는 각 코드를 환경변수나 외부 DB에 저장하는 것이 좋지만
// 지금은 결정론적 코드 생성으로 우회 방지

function generateCode(email, days) {
  // 이메일 + 날짜 + 시크릿으로 고유 코드 생성
  const secret = process.env.CODE_SECRET || 'saju_secret_2024';
  const date = new Date().toISOString().slice(0, 10);
  const raw = `${email}:${days}:${date}:${secret}`;
  
  // 간단한 해시 생성
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  // 8자리 대문자 코드
  const code = Math.abs(hash).toString(36).toUpperCase().slice(0, 8).padStart(8, 'X');
  return code;
}

// 이벤트 코드 설정
const EVENT_CODES = {
  'OPEN100': { days: 30, limit: 100 },
  'SAJUOPEN': { days: 30, limit: 100 },
};

// 이벤트 코드 사용 횟수 (메모리 기반 - 서버 재시작 시 초기화됨)
// 실제 운영 시 Vercel KV 또는 외부 DB 사용 권장
const eventUsage = {};

function verifyCode(code, email) {
  // 이벤트 코드 먼저 확인
  if (EVENT_CODES[code]) {
    const event = EVENT_CODES[code];
    const used = eventUsage[code] || 0;
    
    if (used >= event.limit) {
      return { valid: false, error: '이벤트가 종료되었습니다. (선착순 마감)' };
    }
    
    // 사용 횟수 증가
    eventUsage[code] = used + 1;
    console.log(`이벤트 코드 ${code} 사용: ${eventUsage[code]}/${event.limit}`);
    
    return { valid: true, days: event.days, event: true, remaining: event.limit - eventUsage[code] };
  }
  
  // 오늘 날짜로 생성된 코드인지 확인 (7일 유효)
  const secret = process.env.CODE_SECRET || 'saju_secret_2024';
  
  for (let daysAgo = 0; daysAgo < 7; daysAgo++) {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    const dateStr = date.toISOString().slice(0, 10);
    
    for (const days of [7, 30, 90, 365]) {
      const raw = `${email}:${days}:${dateStr}:${secret}`;
      let hash = 0;
      for (let i = 0; i < raw.length; i++) {
        const char = raw.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      const expectedCode = Math.abs(hash).toString(36).toUpperCase().slice(0, 8).padStart(8, 'X');
      if (expectedCode === code) {
        return { valid: true, days };
      }
    }
  }
  return { valid: false };
}

export default async function handler(req, res) {
  const { action, password, email, days, code } = req.body || {};

  // 코드 검증 (사용자용 - 비밀번호 불필요)
  if (req.method === 'POST' && action === 'verify') {
    if (!code || !email) {
      return res.status(400).json({ error: '코드와 이메일을 입력해주세요.' });
    }
    const result = verifyCode(code.toUpperCase(), email.toLowerCase().trim());
    if (result.valid) {
      return res.status(200).json({ valid: true, days: result.days });
    } else {
      return res.status(200).json({ valid: false, error: '유효하지 않은 코드입니다.' });
    }
  }

  // 코드 생성 (관리자용)
  if (req.method === 'POST' && action === 'generate') {
    if (password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: '비밀번호가 틀렸습니다.' });
    }
    if (!email || !days) {
      return res.status(400).json({ error: '이메일과 기간을 입력해주세요.' });
    }
    const code = generateCode(email.toLowerCase().trim(), parseInt(days));
    return res.status(200).json({ 
      code,
      email,
      days: parseInt(days),
      message: `${email}에게 발급할 ${days}일 구독 코드: ${code}`
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
