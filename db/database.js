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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('게임 테이블 생성 오류:', err.message);
    } else {
      console.log('게임 테이블이 준비되었습니다.');
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
  
  // contracts 테이블 확인 및 처리
  pendingOperations++;
  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='contracts'", (err, result) => {
    if (err) {
      console.error('contracts 테이블 조회 오류:', err.message);
      completeOperation();
      return;
    }

    if (result) {
      // contracts 테이블이 이미 존재하면 컬럼 확인 및 추가
      db.all("PRAGMA table_info(contracts)", (pragmaErr, columns) => {
        if (pragmaErr) {
          console.error('contracts 컬럼 정보 조회 오류:', pragmaErr.message);
          completeOperation();
          return;
        }
        
        const columnNames = columns.map(col => col.name);
        console.log('현재 contracts 테이블 컬럼:', columnNames);
        
        let pendingAlters = 0;
        
        // selected_vendor 컬럼이 없으면 추가
        if (!columnNames.includes('selected_vendor')) {
          pendingAlters++;
          db.run("ALTER TABLE contracts ADD COLUMN selected_vendor TEXT", (alterErr) => {
            if (alterErr) {
              console.error('selected_vendor 컬럼 추가 오류:', alterErr.message);
            } else {
              console.log('selected_vendor 컬럼이 추가되었습니다.');
            }
            
            if (--pendingAlters === 0) {
              completeOperation();
            }
          });
        }
        
        // contract_amount 컬럼이 없으면 추가
        if (!columnNames.includes('contract_amount')) {
          pendingAlters++;
          db.run("ALTER TABLE contracts ADD COLUMN contract_amount TEXT", (alterErr) => {
            if (alterErr) {
              console.error('contract_amount 컬럼 추가 오류:', alterErr.message);
            } else {
              console.log('contract_amount 컬럼이 추가되었습니다.');
            }
            
            if (--pendingAlters === 0) {
              completeOperation();
            }
          });
        }
        
        // work_start_date 컬럼이 없으면 추가
        if (!columnNames.includes('work_start_date')) {
          pendingAlters++;
          db.run("ALTER TABLE contracts ADD COLUMN work_start_date TEXT", (alterErr) => {
            if (alterErr) {
              console.error('work_start_date 컬럼 추가 오류:', alterErr.message);
            } else {
              console.log('work_start_date 컬럼이 추가되었습니다.');
            }
            
            if (--pendingAlters === 0) {
              completeOperation();
            }
          });
        }
        
        // work_end_date 컬럼이 없으면 추가
        if (!columnNames.includes('work_end_date')) {
          pendingAlters++;
          db.run("ALTER TABLE contracts ADD COLUMN work_end_date TEXT", (alterErr) => {
            if (alterErr) {
              console.error('work_end_date 컬럼 추가 오류:', alterErr.message);
            } else {
              console.log('work_end_date 컬럼이 추가되었습니다.');
            }
            
            if (--pendingAlters === 0) {
              completeOperation();
            }
          });
        }
        
        // work_status 컬럼이 없으면 추가
        if (!columnNames.includes('work_status')) {
          pendingAlters++;
          db.run("ALTER TABLE contracts ADD COLUMN work_status TEXT", (alterErr) => {
            if (alterErr) {
              console.error('work_status 컬럼 추가 오류:', alterErr.message);
            } else {
              console.log('work_status 컬럼이 추가되었습니다.');
            }
            
            if (--pendingAlters === 0) {
              completeOperation();
            }
          });
        }
        
        // assigned_game_id 컬럼이 없으면 추가 (포인트를 사용할 게임 지정)
        if (!columnNames.includes('assigned_game_id')) {
          pendingAlters++;
          db.run("ALTER TABLE contracts ADD COLUMN assigned_game_id INTEGER", (alterErr) => {
            if (alterErr) {
              console.error('assigned_game_id 컬럼 추가 오류:', alterErr.message);
            } else {
              console.log('assigned_game_id 컬럼이 추가되었습니다.');
            }
            
            if (--pendingAlters === 0) {
              completeOperation();
            }
          });
        }
        
        // points_used 컬럼이 없으면 추가 (총 사용된 포인트)
        if (!columnNames.includes('points_used')) {
          pendingAlters++;
          db.run("ALTER TABLE contracts ADD COLUMN points_used INTEGER DEFAULT 0", (alterErr) => {
            if (alterErr) {
              console.error('points_used 컬럼 추가 오류:', alterErr.message);
            } else {
              console.log('points_used 컬럼이 추가되었습니다.');
            }
            
            if (--pendingAlters === 0) {
              completeOperation();
            }
          });
        }
        
        // self_points_used 컬럼이 없으면 추가 (사용된 자부담포인트)
        if (!columnNames.includes('self_points_used')) {
          pendingAlters++;
          db.run("ALTER TABLE contracts ADD COLUMN self_points_used INTEGER DEFAULT 0", (alterErr) => {
            if (alterErr) {
              console.error('self_points_used 컬럼 추가 오류:', alterErr.message);
            } else {
              console.log('self_points_used 컬럼이 추가되었습니다.');
            }
            
            if (--pendingAlters === 0) {
              completeOperation();
            }
          });
        }
        
        // base_points_used 컬럼이 없으면 추가 (사용된 기본포인트)
        if (!columnNames.includes('base_points_used')) {
          pendingAlters++;
          db.run("ALTER TABLE contracts ADD COLUMN base_points_used INTEGER DEFAULT 0", (alterErr) => {
            if (alterErr) {
              console.error('base_points_used 컬럼 추가 오류:', alterErr.message);
            } else {
              console.log('base_points_used 컬럼이 추가되었습니다.');
            }
            
            if (--pendingAlters === 0) {
              completeOperation();
            }
          });
        }
        
        // use_self_points 컬럼이 없으면 추가
        if (!columnNames.includes('use_self_points')) {
          pendingAlters++;
          db.run("ALTER TABLE contracts ADD COLUMN use_self_points INTEGER DEFAULT 0", (alterErr) => {
            if (alterErr) {
              console.error('use_self_points 컬럼 추가 오류:', alterErr.message);
            } else {
              console.log('use_self_points 컬럼이 추가되었습니다.');
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
      // contracts 테이블이 없으면 기타 테이블 생성 함수에서 처리됨
      completeOperation();
    }
  });

  // contract_meta 테이블 확인 및 생성
  pendingOperations++;
  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='contract_meta'", (err, result) => {
    if (err) {
      console.error('contract_meta 테이블 조회 오류:', err.message);
      completeOperation();
      return;
    }

    if (!result) {
      // contract_meta 테이블이 없으면 생성
      db.run(`
        CREATE TABLE IF NOT EXISTS contract_meta (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          contract_id TEXT NOT NULL UNIQUE,
          point_usage_db_code TEXT,
          additional_info TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `, (createErr) => {
        if (createErr) {
          console.error('contract_meta 테이블 생성 오류:', createErr.message);
        } else {
          console.log('contract_meta 테이블이 생성되었습니다.');
        }
        completeOperation();
      });
    } else {
      console.log('contract_meta 테이블이 이미 존재합니다.');
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
      selected_vendor TEXT,
      contract_amount TEXT,
      work_start_date TEXT,
      work_end_date TEXT,
      work_status TEXT,
      assigned_game_id INTEGER,
      points_used INTEGER DEFAULT 0,
      self_points_used INTEGER DEFAULT 0,
      base_points_used INTEGER DEFAULT 0,
      use_self_points INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('계약 정보 테이블 생성 오류:', err.message);
    } else {
      console.log('계약 정보 테이블이 준비되었습니다.');
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
  
  // 앱 설정 테이블 생성
  db.run(`
    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      setting_key TEXT UNIQUE NOT NULL,
      setting_value TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('앱 설정 테이블 생성 오류:', err.message);
    } else {
      console.log('앱 설정 테이블이 준비되었습니다.');
      
      // 초기 설정 값 추가
      db.get("SELECT * FROM app_settings WHERE setting_key = 'last_sync_time'", (err, row) => {
        if (err) {
          console.error('앱 설정 조회 오류:', err.message);
        } else if (!row) {
          // 마지막 동기화 시간 초기값 설정
          db.run("INSERT INTO app_settings (setting_key, setting_value) VALUES ('last_sync_time', ?)", 
            [new Date().toISOString()], 
            (err) => {
              if (err) {
                console.error('초기 동기화 시간 설정 오류:', err.message);
              } else {
                console.log('초기 동기화 시간이 설정되었습니다.');
              }
            }
          );
        }
      });
    }
    tableCreated();
  });
  
  // 시스템 상태 초기화
  db.run(`
    CREATE TABLE IF NOT EXISTS system_status (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      status_key TEXT UNIQUE NOT NULL,
      status_value TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('시스템 상태 테이블 생성 오류:', err.message);
    } else {
      console.log('시스템 상태 테이블이 준비되었습니다.');
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