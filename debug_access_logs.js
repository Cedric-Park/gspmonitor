const express = require('express');
const path = require('path');
const db = require('./db/database');
const expressLayouts = require('express-ejs-layouts');
const fs = require('fs');

// 간단한 Express 앱 생성
const app = express();
const PORT = 4321;

// 뷰 엔진 설정
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

// 정적 파일 제공
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));

// 글로벌 변수 설정
app.use((req, res, next) => {
  res.locals.user = { 
    id: '1', 
    name: '디버그 관리자', 
    email: 'debug@example.com',
    role: '어드민'
  };
  next();
});

// 오류 방지를 위한 날짜 변환 함수 추가
app.locals.formatDate = function(dateStr) {
  try {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleString('ko-KR');
  } catch (e) {
    console.error('날짜 변환 오류:', e);
    return dateStr;
  }
};

// 디버깅용 접속 로그 템플릿 생성
const debugTemplate = `
<div class="container-fluid mt-4">
  <div class="row">
    <div class="col-md-12">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h2>담당자 접속 로그 (디버깅)</h2>
      </div>
      
      <!-- 접속 로그 테이블 -->
      <div class="card">
        <div class="card-header bg-light d-flex justify-content-between align-items-center">
          <h5 class="mb-0">접속 로그 목록</h5>
          <span class="badge bg-secondary"><%= logs.length %>개 항목</span>
        </div>
        <div class="card-body p-0">
          <div class="table-responsive">
            <table class="table table-hover table-striped mb-0">
              <thead class="table-light">
                <tr>
                  <th>ID</th>
                  <th>담당자</th>
                  <th>액션</th>
                  <th>상태</th>
                  <th>IP 주소</th>
                  <th>로그인 시간 (원본)</th>
                  <th>로그인 시간 (변환)</th>
                  <th>세션 정보</th>
                </tr>
              </thead>
              <tbody>
                <% if (logs.length === 0) { %>
                  <tr>
                    <td colspan="8" class="text-center py-4">
                      <i class="bi bi-info-circle me-2"></i> 조회된 접속 로그가 없습니다.
                    </td>
                  </tr>
                <% } else { %>
                  <% logs.forEach(log => { %>
                    <tr>
                      <td><%= log.id %></td>
                      <td>
                        <% if (log.manager_name) { %>
                          <strong><%= log.manager_name %></strong><br>
                          <small class="text-muted"><%= log.manager_email %></small>
                        <% } else { %>
                          <small class="text-muted"><%= log.manager_email || 'unknown' %></small>
                        <% } %>
                      </td>
                      <td><%= log.action %></td>
                      <td><%= log.login_status %></td>
                      <td><%= log.ip_address || '-' %></td>
                      <td><code><%= log.login_time %></code></td>
                      <td>
                        <% try { %>
                          <%= log.login_time ? formatDate(log.login_time) : '-' %>
                        <% } catch (e) { %>
                          <span class="text-danger">오류: <%= e.message %></span>
                        <% } %>
                      </td>
                      <td>
                        <small class="text-muted"><%= log.session_id || '-' %></small>
                      </td>
                    </tr>
                  <% }); %>
                <% } %>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
`;

// 디버깅 템플릿 파일 생성
const debugTemplatePath = path.join(__dirname, 'views', 'managers', 'access-logs-debug.ejs');
try {
  fs.mkdirSync(path.dirname(debugTemplatePath), { recursive: true });
  fs.writeFileSync(debugTemplatePath, debugTemplate);
  console.log('디버깅 템플릿 파일 생성 완료:', debugTemplatePath);
} catch (err) {
  console.error('템플릿 파일 생성 오류:', err);
}

// 접속 로그 라우트 (디버깅용)
app.get('/', async (req, res) => {
  try {
    console.log('접속 로그 페이지 디버깅 시작...');
    
    // 필터링 옵션 (빈 값으로 설정)
    const filters = {
      manager_id: '',
      action: '',
      start_date: '',
      end_date: ''
    };
    
    // 모든 담당자 목록 가져오기
    const managers = await new Promise((resolve, reject) => {
      db.all("SELECT id, name, email FROM managers", (err, rows) => {
        if (err) {
          console.error('담당자 조회 오류:', err);
          reject(err);
          return;
        }
        resolve(rows || []);
      });
    });
    
    console.log('담당자 목록 조회 완료:', managers.length);
    
    // 접속 로그 쿼리 구성
    let query = `
      SELECT al.*, m.name as manager_name, m.email as manager_email
      FROM access_logs al
      LEFT JOIN managers m ON al.manager_id = m.id
      ORDER BY al.login_time DESC
    `;
    
    console.log('실행할 SQL 쿼리:', query);
    
    // 접속 로그 가져오기
    const logs = await new Promise((resolve, reject) => {
      db.all(query, (err, rows) => {
        if (err) {
          console.error('접속 로그 조회 오류:', err);
          reject(err);
          return;
        }
        
        console.log('접속 로그 조회 완료:', rows ? rows.length : 0);
        if (rows && rows.length > 0) {
          console.log('첫 번째 로그 샘플:', JSON.stringify(rows[0], null, 2));
        }
        
        // 날짜 형식 문제 확인
        rows.forEach(log => {
          try {
            if (log.login_time) {
              const date = new Date(log.login_time);
              console.log(`로그 ID ${log.id} 로그인 시간: ${log.login_time}, 변환 결과: ${date.toLocaleString('ko-KR')}`);
            }
          } catch (e) {
            console.error(`로그 ID ${log.id} 날짜 변환 오류:`, e.message);
          }
        });
        
        resolve(rows || []);
      });
    });
    
    console.log('렌더링 시도...');
    
    // 렌더링
    res.render('managers/access-logs-debug', {
      title: '담당자 접속 로그 (디버깅)',
      logs,
      managers,
      filters
    });
    
    console.log('페이지 렌더링 완료');
  } catch (error) {
    console.error('접속 로그 디버깅 오류:', error);
    res.status(500).send(`
      <h1>오류 발생</h1>
      <p>접속 로그를 불러오는 중 오류가 발생했습니다.</p>
      <pre>${error.stack}</pre>
    `);
  }
});

// 디버깅용 에러 핸들러
app.use((err, req, res, next) => {
  console.error('오류 발생:', err);
  res.status(500).send(`
    <h1>오류 발생</h1>
    <p>서버 오류가 발생했습니다.</p>
    <pre>${err.stack}</pre>
  `);
});

// 서버 시작
console.log('디버깅 서버 시작 중...');

// 서버 직접 시작
console.log('데이터베이스 초기화 대기 없이 서버 시작...');
app.listen(PORT, () => {
  console.log(`디버깅 서버가 포트 ${PORT}에서 실행 중입니다.`);
  console.log(`http://localhost:${PORT} 에서 접속 로그 페이지를 확인하세요.`);
}); 