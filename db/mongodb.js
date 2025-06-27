const { MongoClient } = require('mongodb');
const path = require('path');
const dotenv = require('dotenv');
const { URL } = require('url');

// 환경 변수 설정
dotenv.config();

// MongoDB 연결 문자열 (환경 변수에서 가져오거나 기본값 사용)
const uri = process.env.MONGODB_URI || 'mongodb+srv://<username>:<password>@cluster0.mongodb.net/game_points?retryWrites=true&w=majority';

// 연결 문자열에서 데이터베이스 이름 추출
function getDatabaseName(connectionString) {
  try {
    const url = new URL(connectionString);
    const pathParts = url.pathname.split('/');
    // 경로의 첫 번째 부분은 빈 문자열이므로 두 번째 부분 사용
    return pathParts[1] || 'game_points'; // 기본값으로 'game_points' 사용
  } catch (error) {
    console.error('연결 문자열에서 데이터베이스 이름을 추출하는 중 오류 발생:', error);
    return 'game_points'; // 오류 발생 시 기본값 반환
  }
}

const dbName = getDatabaseName(uri);

// 데이터베이스 초기화 완료 후 콜백 함수를 저장할 변수
let onDatabaseInitialized = null;
let dbClient = null;
let database = null;

// MongoDB 연결 함수
async function connectToDatabase() {
  if (dbClient) {
    return { client: dbClient, db: database };
  }

  try {
    // MongoDB 클라이언트 생성
    const client = new MongoClient(uri);
    
    // 연결 시도
    await client.connect();
    console.log('MongoDB 데이터베이스에 연결되었습니다.');
    
    // 데이터베이스 선택
    const db = client.db(dbName);
    console.log(`'${dbName}' 데이터베이스 선택됨`);
    
    // 클라이언트와 데이터베이스 저장
    dbClient = client;
    database = db;
    
    // 초기화 콜백 호출
    if (onDatabaseInitialized) {
      onDatabaseInitialized();
    }
    
    return { client, db };
  } catch (error) {
    console.error('MongoDB 연결 오류:', error);
    throw error;
  }
}

// 데이터베이스 초기화 콜백 설정
function setInitCallback(callback) {
  onDatabaseInitialized = callback;
  
  // 이미 연결되어 있으면 바로 콜백 호출
  if (database) {
    callback();
  }
}

// 게임 정보 가져오기
async function getGames() {
  try {
    const { db } = await connectToDatabase();
    const games = await db.collection('games').find({}).toArray();
    return games;
  } catch (error) {
    console.error('게임 정보 조회 오류:', error);
    return [];
  }
}

// 게임 정보 저장하기
async function saveGame(gameData) {
  try {
    const { db } = await connectToDatabase();
    const result = await db.collection('games').insertOne(gameData);
    return result;
  } catch (error) {
    console.error('게임 정보 저장 오류:', error);
    throw error;
  }
}

// 게임 정보 업데이트하기
async function updateGame(id, gameData) {
  try {
    const { db } = await connectToDatabase();
    const result = await db.collection('games').updateOne(
      { _id: id },
      { $set: gameData }
    );
    return result;
  } catch (error) {
    console.error('게임 정보 업데이트 오류:', error);
    throw error;
  }
}

// 게임 정보 삭제하기
async function deleteGame(id) {
  try {
    const { db } = await connectToDatabase();
    const result = await db.collection('games').deleteOne({ _id: id });
    return result;
  } catch (error) {
    console.error('게임 정보 삭제 오류:', error);
    throw error;
  }
}

// 연결 종료 함수
async function closeConnection() {
  if (dbClient) {
    await dbClient.close();
    dbClient = null;
    database = null;
    console.log('MongoDB 연결이 종료되었습니다.');
  }
}

module.exports = {
  connectToDatabase,
  getGames,
  saveGame,
  updateGame,
  deleteGame,
  closeConnection,
  setInitCallback
}; 