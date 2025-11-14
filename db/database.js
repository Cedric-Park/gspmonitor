const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const config = require('../config/config');

// 데이터베이스 초기화 완료 후 콜백 함수를 저장할 변수
let onDatabaseInitialized = null;

// 데이터베이스 파일 경로
// __dirname은 현재 파일(database.js)이 있는 디렉토리(db)를 가리킴
// 상위 디렉토리로 올라간 후 config.database.path 설정 적용
const dbPath = path.resolve(path.join(__dirname, '..'), 'db', 'game_points.db');

// 데이터베이스 연결
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('데이터베이스 연결 오류:', err.message);
    return;
  }
  console.log('SQLite 데이터베이스에 연결되었습니다.');
  console.log('데이터베이스 경로:', dbPath);
  
  // 데이터베이스 초기화
  initDatabase();
});

// 데이터베이스 초기화 함수
function initDatabase() {
  let pendingOperations = 1; // 대기 중인 작업 수 (초기값 1)

  // 작업이 완료될 때마다 호출되는 함수
  function completeOperation() {
    pendingOperations--;
    if (pendingOperations === 0 && onDatabaseInitialized) {
      onDatabaseInitialized();
    }
  }

  // 게임 정보 테이블 생성
  pendingOperations++;
  db.run(`
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_name TEXT NOT NULL,
      company_name TEXT NOT NULL,
      platform TEXT,
      base_points INTEGER DEFAULT 0,
      self_points INTEGER DEFAULT 0,
      total_points INTEGER DEFAULT 0,
      excellent_1st_points INTEGER DEFAULT 0,
      excellent_2nd_points INTEGER DEFAULT 0,
      excellent_3rd_points INTEGER DEFAULT 0,
      is_excellent_1st BOOLEAN DEFAULT 0,
      is_excellent_2nd BOOLEAN DEFAULT 0,
      is_excellent_3rd BOOLEAN DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('게임 테이블 생성 오류:', err.message);
    } else {
      console.log('게임 테이블이 준비되었습니다.');
      
      // 기존 테이블에 새 컬럼들 추가 (ALTER TABLE)
      addExcellentPointsColumns();
    }
    completeOperation();
  });

  // managers 테이블 확인 및 처리
  pendingOperations++;
  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='managers'", (err, result) => {
    if (err) {
      console.error('테이블 조회 오류:', err.message);
      completeOperation();
      return;
    }

    if (result) {
      // managers 테이블이 이미 존재하면 컬럼 확인 및 추가
      db.all("PRAGMA table_info(managers)", (pragmaErr, columns) => {
        if (pragmaErr) {
          console.error('컬럼 정보 조회 오류:', pragmaErr.message);
          completeOperation();
          return;
        }
        
        const columnNames = columns.map(col => col.name);
        console.log('현재 managers 테이블 컬럼:', columnNames);
        
        let pendingAlters = 0;
        
        // password 컬럼이 없으면 추가
        if (!columnNames.includes('password')) {
          pendingAlters++;
          db.run("ALTER TABLE managers ADD COLUMN password TEXT DEFAULT '1234'", (alterErr) => {
            if (alterErr) {
              console.error('password 컬럼 추가 오류:', alterErr.message);
            } else {
              console.log('password 컬럼이 추가되었습니다.');
            }
            
            if (--pendingAlters === 0) {
              completeOperation();
            }
          });
        }
        
        // role 컬럼이 없으면 추가
        if (!columnNames.includes('role')) {
          pendingAlters++;
          db.run("ALTER TABLE managers ADD COLUMN role TEXT DEFAULT '담당자'", (alterErr) => {
            if (alterErr) {
              console.error('role 컬럼 추가 오류:', alterErr.message);
            } else {
              console.log('role 컬럼이 추가되었습니다.');
            }
            
            if (--pendingAlters === 0) {
              completeOperation();
            }
          });
        }
        
        // 아무 컬럼도 추가하지 않은 경우
        if (pendingAlters === 0) {
          completeOperation();
        }
      });
    } else {
      // managers 테이블이 없으면 새로 생성
      createManagersTable();
      completeOperation();
    }
  });
  
  // 기타 테이블 생성...
  pendingOperations++;
  createOtherTables(() => {
    completeOperation();
  });
  
  // 초기 카운터 감소
  completeOperation();
}

// 담당자 테이블 생성 함수
function createManagersTable() {
  db.run(`
    CREATE TABLE IF NOT EXISTS managers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT DEFAULT '1234',
      role TEXT DEFAULT '담당자',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('담당자 테이블 생성 오류:', err.message);
    } else {
      console.log('담당자 테이블이 준비되었습니다.');
    }
  });
}

// 우수포인트 컬럼 추가 함수
function addExcellentPointsColumns() {
  // 기존 테이블에 우수포인트 관련 컬럼들이 있는지 확인하고 없으면 추가
  db.all("PRAGMA table_info(games)", (err, columns) => {
    if (err) {
      console.error('게임 테이블 컬럼 정보 조회 오류:', err.message);
      return;
    }
    
    const columnNames = columns.map(col => col.name);
    console.log('현재 games 테이블 컬럼:', columnNames);
    
    const columnsToAdd = [
      { name: 'excellent_1st_points', definition: 'INTEGER DEFAULT 0' },
      { name: 'excellent_2nd_points', definition: 'INTEGER DEFAULT 0' },
      { name: 'excellent_3rd_points', definition: 'INTEGER DEFAULT 0' },
      { name: 'is_excellent_1st', definition: 'BOOLEAN DEFAULT 0' },
      { name: 'is_excellent_2nd', definition: 'BOOLEAN DEFAULT 0' },
      { name: 'is_excellent_3rd', definition: 'BOOLEAN DEFAULT 0' }
    ];
    
    columnsToAdd.forEach(column => {
      if (!columnNames.includes(column.name)) {
        db.run(`ALTER TABLE games ADD COLUMN ${column.name} ${column.definition}`, (alterErr) => {
          if (alterErr) {
            console.error(`${column.name} 컬럼 추가 오류:`, alterErr.message);
          } else {
            console.log(`${column.name} 컬럼이 추가되었습니다.`);
          }
        });
      }
    });
  });
}

// contracts 테이블에 manager_id 컬럼 추가 함수
function addManagerIdToContracts() {
  db.all("PRAGMA table_info(contracts)", (err, columns) => {
    if (err) {
      console.error('계약 테이블 컬럼 정보 조회 오류:', err.message);
      return;
    }
    
    const columnNames = columns.map(col => col.name);
    
    if (!columnNames.includes('manager_id')) {
      db.run('ALTER TABLE contracts ADD COLUMN manager_id INTEGER', (alterErr) => {
        if (alterErr) {
          console.error('manager_id 컬럼 추가 오류:', alterErr.message);
        } else {
          console.log('contracts 테이블에 manager_id 컬럼이 추가되었습니다.');
          // 기존 계약 데이터에 담당자 매핑
          updateContractManagers();
        }
      });
    }
    
    // memo 컬럼 추가
    if (!columnNames.includes('memo')) {
      db.run('ALTER TABLE contracts ADD COLUMN memo TEXT', (alterErr) => {
        if (alterErr) {
          console.error('memo 컬럼 추가 오류:', alterErr.message);
        } else {
          console.log('contracts 테이블에 memo 컬럼이 추가되었습니다.');
        }
      });
    }
  });
}

// 기존 계약 데이터에 담당자 매핑 업데이트
function updateContractManagers() {
  // company_managers 테이블을 통해 게임사별 첫 번째 담당자를 계약에 매핑
  const query = `
    UPDATE contracts
    SET manager_id = (
      SELECT cm.manager_id 
      FROM company_managers cm
      WHERE cm.company_name = contracts.company_name
      LIMIT 1
    )
    WHERE manager_id IS NULL
  `;
  
  db.run(query, (err) => {
    if (err) {
      console.error('계약 담당자 매핑 업데이트 오류:', err.message);
    } else {
      console.log('기존 계약 데이터에 담당자가 매핑되었습니다.');
    }
  });
}

// 기타 테이블 생성 함수
function createOtherTables(callback) {
  let pendingTables = 6; // 생성할 테이블 수 (5에서 6으로 변경)
  
  function tableCreated() {
    pendingTables--;
    if (pendingTables === 0 && callback) {
      callback();
    }
  }

  // 게임사-담당자 매핑 테이블 생성
  db.run(`
    CREATE TABLE IF NOT EXISTS company_managers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_name TEXT NOT NULL,
      manager_id INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (manager_id) REFERENCES managers (id),
      UNIQUE(company_name, manager_id)
    )
  `, (err) => {
    if (err) {
      console.error('게임사-담당자 매핑 테이블 생성 오류:', err.message);
    } else {
      console.log('게임사-담당자 매핑 테이블이 준비되었습니다.');
    }
    tableCreated();
  });

  // 알림 설정 테이블 생성
  db.run(`
    CREATE TABLE IF NOT EXISTS notification_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_name TEXT,
      game_name TEXT,
      email TEXT NOT NULL,
      threshold INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('알림 설정 테이블 생성 오류:', err.message);
    } else {
      console.log('알림 설정 테이블이 준비되었습니다.');
    }
    tableCreated();
  });
  
  // 계약 정보 테이블 생성
  db.run(`
    CREATE TABLE IF NOT EXISTS contracts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_id TEXT UNIQUE, 
      service_category TEXT,
      service_detail TEXT,
      service_request TEXT,
      company_name TEXT NOT NULL,
      quote_count TEXT,
      bid_deadline TEXT,
      selection_deadline TEXT,
      status TEXT,
      quote_details TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('계약 정보 테이블 생성 오류:', err.message);
    } else {
      console.log('계약 정보 테이블이 준비되었습니다.');
      // manager_id 컬럼 추가
      addManagerIdToContracts();
    }
    tableCreated();
  });
  
  // 알림 이력 테이블 생성
  db.run(`
    CREATE TABLE IF NOT EXISTS notification_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      setting_id INTEGER,
      message TEXT NOT NULL,
      sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (setting_id) REFERENCES notification_settings (id)
    )
  `, (err) => {
    if (err) {
      console.error('알림 이력 테이블 생성 오류:', err.message);
    } else {
      console.log('알림 이력 테이블이 준비되었습니다.');
    }
    tableCreated();
  });
  
  // 접속 로그 테이블 생성
  db.run(`
    CREATE TABLE IF NOT EXISTS access_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      manager_id INTEGER,
      manager_name TEXT,
      manager_email TEXT,
      manager_role TEXT,
      action TEXT,
      ip_address TEXT,
      user_agent TEXT,
      login_status TEXT,
      login_time TEXT,
      logout_time TEXT,
      session_id TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (manager_id) REFERENCES managers (id)
    )
  `, (err) => {
    if (err) {
      console.error('접속 로그 테이블 생성 오류:', err.message);
    } else {
      console.log('접속 로그 테이블이 준비되었습니다.');
    }
    tableCreated();
  });
}

// 데이터베이스 초기화 완료 후 콜백 설정 함수
function setInitCallback(callback) {
  onDatabaseInitialized = callback;
}

module.exports = db;
module.exports.setInitCallback = setInitCallback; 