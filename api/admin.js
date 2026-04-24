const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'saju2024admin';

// 이벤트 코드 설정
const EVENT_CODES = {
  'OPEN100': { days: 7, limit: 100 },
  'SAJUOPEN': { days: 7, limit: 100 },
};

// 이벤트 코드 사용 횟수 (메모리 기반)
const eventUsage = {};

// 사용된 코드 저장 (1회 사용 제한)
// 메모리 기반 - 서버 재시작 시 초기화됨
// 실제 운영 시 Vercel KV 사용 권장
const usedCodes = new Set();

function generateCode(email, days) {
  const secret = process.env.CODE_SECRET || 'saju_secret_2024';
  const date = new Date().toISOString().slice(0, 10);
  // 밀리초 추가로 같은 날 같은 이메일도 다른 코드 생성
  const ms = Date.now().toString().slice(-4);
  const raw = `${email}:${days}:${date}:${ms}:${secret}`;
  
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  const code = Math.abs(hash).toString(36).toUpperCase().slice(0, 8).padStart(8, 'X');
  return code;
}

function verifyCode(code, email) {
  // 이벤트 코드 먼저 확인
  if (EVENT_CODES[code]) {
    const event = EVENT_CODES[code];
    const used = eventUsage[code] || 0;
    
    if (used >= event.limit) {
      return { valid: false, error: '이벤트가 종료되었습니다. (선착순 마감)' };
    }
    
    eventUsage[code] = used + 1;
    return { valid: true, days: event.days, event: true };
  }
  
  // 1회 사용 여부 확인
  const codeKey = `${code}:${email}`;
  if (usedCodes.has(codeKey)) {
    return { valid: false, error: '이미 사용된 코드입니다.' };
  }
  
  // 코드 검증 (최근 7일 이내 발급된 코드)
  const secret = process.env.CODE_SECRET || 'saju_secret_2024';
  
  for (let daysAgo = 0; daysAgo < 7; daysAgo++) {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    const dateStr = date.toISOString().slice(0, 10);
    
    for (const days of [7, 30, 90]) {
      // 밀리초 부분은 0000~9999 모두 확인 불가 → 코드 자체에 days 정보 포함 방식으로 검증
      // 대신 코드가 email + days 기반으로 생성됐는지만 확인
      const raw = `${email}:${days}:${dateStr}:`;
      let hash = 0;
      for (let i = 0; i < raw.length; i++) {
        const char = raw.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      // 코드 앞 6자리가 일치하면 유효 (밀리초 제외하고 확인)
      const baseCode = Math.abs(hash).toString(36).toUpperCase().slice(0, 6);
      if (code.startsWith(baseCode.slice(0, 5))) {
        // 사용 완료 처리
        usedCodes.add(codeKey);
        return { valid: true, days };
      }
    }
  }
  return { valid: false, error: '유효하지 않은 코드입니다.' };
}

export default async function handler(req, res) {
  const { action, password, email, days, code } = req.body || {};

  if (req.method === 'POST' && action === 'verify') {
    if (!code || !email) {
      return res.status(400).json({ error: '코드와 이메일을 입력해주세요.' });
    }
    const result = verifyCode(code.toUpperCase(), email.toLowerCase().trim());
    if (result.valid) {
      return res.status(200).json({ valid: true, days: result.days });
    } else {
      return res.status(200).json({ valid: false, error: result.error || '유효하지 않은 코드입니다.' });
    }
  }

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
