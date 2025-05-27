const db = require('../db/database');
const nodemailer = require('nodemailer');
const schedule = require('node-schedule');
const config = require('../config/config');
const gameModel = require('./game');
const managerModel = require('./manager');

// 이메일 전송을 위한 트랜스포터 설정
const transporter = nodemailer.createTransport({
  service: config.email.service,
  auth: {
    user: config.email.user,
    pass: config.email.password
  }
});

// 알림 설정 추가
function addNotificationSetting(setting) {
  return new Promise((resolve, reject) => {
    const query = `
      INSERT INTO notification_settings (company_name, game_name, email, threshold, is_active)
      VALUES (?, ?, ?, ?, ?)
    `;
    
    db.run(
      query, 
      [setting.company_name, setting.game_name, setting.email, setting.threshold, setting.is_active ? 1 : 0],
      function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve({ id: this.lastID, ...setting });
      }
    );
  });
}

// 알림 설정 업데이트
function updateNotificationSetting(id, setting) {
  return new Promise((resolve, reject) => {
    const query = `
      UPDATE notification_settings
      SET company_name = ?, game_name = ?, email = ?, threshold = ?, is_active = ?
      WHERE id = ?
    `;
    
    db.run(
      query, 
      [setting.company_name, setting.game_name, setting.email, setting.threshold, setting.is_active ? 1 : 0, id],
      function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve({ id, ...setting, changes: this.changes });
      }
    );
  });
}

// 알림 설정 삭제
function deleteNotificationSetting(id) {
  return new Promise((resolve, reject) => {
    const query = `DELETE FROM notification_settings WHERE id = ?`;
    
    db.run(query, [id], function(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve({ id, deleted: this.changes > 0 });
    });
  });
}

// 모든 알림 설정 가져오기
function getAllNotificationSettings() {
  return new Promise((resolve, reject) => {
    const query = `SELECT * FROM notification_settings ORDER BY created_at DESC`;
    
    db.all(query, [], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

// 특정 회사/게임의 알림 설정 가져오기
function getNotificationSettingsByCompanyGame(company, game) {
  return new Promise((resolve, reject) => {
    let query = `SELECT * FROM notification_settings WHERE 1=1`;
    const params = [];
    
    if (company) {
      query += ` AND company_name = ?`;
      params.push(company);
    }
    
    if (game) {
      query += ` AND game_name = ?`;
      params.push(game);
    }
    
    db.all(query, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

// 알림 이력 추가
function addNotificationHistory(history) {
  return new Promise((resolve, reject) => {
    const query = `
      INSERT INTO notification_history (setting_id, message)
      VALUES (?, ?)
    `;
    
    db.run(
      query, 
      [history.setting_id, history.message],
      function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve({ id: this.lastID, ...history });
      }
    );
  });
}

// 알림 이력 가져오기
function getNotificationHistory() {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT nh.*, ns.email, ns.company_name, ns.game_name
      FROM notification_history nh
      JOIN notification_settings ns ON nh.setting_id = ns.id
      ORDER BY nh.sent_at DESC
      LIMIT 100
    `;
    
    db.all(query, [], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

// 이메일 알림 발송
async function sendNotificationEmail(to, subject, message) {
  try {
    const mailOptions = {
      from: config.email.user,
      to: to,
      subject: subject,
      html: message
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log('알림 이메일 발송 완료:', info.messageId);
    return info;
  } catch (error) {
    console.error('이메일 발송 오류:', error);
    throw error;
  }
}

// 포인트 임계값 기준 알림 확인
async function checkThresholdNotifications() {
  try {
    // 활성화된 모든 알림 설정 가져오기
    const settings = await getAllNotificationSettings();
    const activeSettings = settings.filter(s => s.is_active);
    
    // 현재 게임 데이터 가져오기
    const games = await gameModel.getAllGames();
    
    // 각 설정에 대해 임계값 체크
    for (const setting of activeSettings) {
      let gameMatches = games;
      
      // 특정 회사로 필터링
      if (setting.company_name) {
        gameMatches = gameMatches.filter(g => g.company_name === setting.company_name);
      }
      
      // 특정 게임으로 필터링
      if (setting.game_name) {
        gameMatches = gameMatches.filter(g => g.game_name === setting.game_name);
      }
      
      // 임계값과 비교
      for (const game of gameMatches) {
        if (game.total_points <= setting.threshold) {
          // 알림 메시지 생성
          const subject = `[포인트 알림] ${game.game_name} 포인트 임계값 도달`;
          const message = `
            <h2>포인트 알림</h2>
            <p><strong>${game.company_name}</strong>의 <strong>${game.game_name}</strong> 게임의 포인트가 임계값(${setting.threshold})에 도달했습니다.</p>
            <ul>
              <li>기본 포인트: ${game.base_points.toLocaleString()}</li>
              <li>자부담 포인트: ${game.self_points.toLocaleString()}</li>
              <li>총 포인트: ${game.total_points.toLocaleString()}</li>
            </ul>
            <p>자세한 내용은 <a href="${config.baseUrl}">포인트 모니터링 시스템</a>에서 확인하세요.</p>
          `;
          
          // 이메일 발송 (기존 설정된 이메일)
          await sendNotificationEmail(setting.email, subject, message);
          
          // 알림 이력 저장
          await addNotificationHistory({
            setting_id: setting.id,
            message: `${game.company_name}의 ${game.game_name} 게임 포인트가 임계값(${setting.threshold})에 도달했습니다.`
          });
          
          // 해당 게임사의 담당자에게도 알림 발송
          try {
            const managerEmails = await managerModel.getManagerEmailsByCompany(game.company_name);
            
            if (managerEmails && managerEmails.length > 0) {
              // 담당자 이메일 중복 제거 (설정된 이메일과 중복될 수 있음)
              const uniqueEmails = [...new Set(managerEmails)].filter(email => email !== setting.email);
              
              if (uniqueEmails.length > 0) {
                // 담당자 이메일로 알림 발송
                await sendNotificationEmail(uniqueEmails.join(','), subject, message);
                console.log(`${game.company_name} 담당자 ${uniqueEmails.length}명에게 알림 발송 완료`);
              }
            }
          } catch (managerError) {
            console.error(`담당자 알림 발송 오류 (${game.company_name}):`, managerError);
          }
        }
      }
    }
    
    return { success: true, message: '알림 체크 완료' };
  } catch (error) {
    console.error('알림 확인 중 오류:', error);
    return { success: false, error: error.message };
  }
}

// 정기적인 알림 체크 스케줄링 (매일 오전 9시)
function scheduleNotificationChecks() {
  schedule.scheduleJob('0 9 * * *', async () => {
    console.log('정기 알림 체크 실행 중...');
    await checkThresholdNotifications();
  });
  console.log('알림 체크 스케줄이 설정되었습니다.');
}

module.exports = {
  addNotificationSetting,
  updateNotificationSetting,
  deleteNotificationSetting,
  getAllNotificationSettings,
  getNotificationSettingsByCompanyGame,
  addNotificationHistory,
  getNotificationHistory,
  sendNotificationEmail,
  checkThresholdNotifications,
  scheduleNotificationChecks
}; 