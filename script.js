// --- 設定：GoogleスプレッドシートのCSV URL ---
// ↓ここに取得した「ウェブに公開」のCSV用URLを貼り付けてください
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSEI2TbAdBCeEoyKBiEhsz_6AdRKxFsllpgsVzTUuzQ6xENSRpohdZiXQYQdQ-JmGwyGwL8FkmqRPdF/pub?gid=0&single=true&output=csv";

// スケジュールデータを格納する変数
let scheduleData = [];

// --- 機能0: データ読み込み (CSV Fetch) ---
async function loadSchedule() {
    try {
        // キャッシュ対策：URLの末尾にランダムな数字をつけて毎回新しいデータを読み込む
        const cacheBuster = "&t=" + new Date().getTime();
        const response = await fetch(SHEET_CSV_URL + cacheBuster);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const text = await response.text();
        console.log("生のCSVデータ:", text); // デバッグ用

        // CSVをパースして配列にする
        // 1行目はヘッダーなので削除
        const rows = text.trim().split('\n').slice(1);
        
        scheduleData = rows.map(row => {
            // 空行はスキップ
            if (!row || row.trim() === "") return null;

            // ★修正ポイント：データに含まれるダブルクォーテーション(")を削除
            // スプレッドシートの仕様で "2026/02/14..." のように囲まれることがあるため
            const cleanRow = row.replace(/"/g, ''); 
            
            const columns = cleanRow.split(',');
            
            // 1列目: 時間
            const time = columns[0].trim();
            
            // 2列目: タイトル
            const title = columns[1] ? columns[1].trim() : "";
            
            // 3列目: 詳細メモ (乗り換え情報など)
            // カンマが含まれていた場合の対策として結合
            const detail = columns.slice(2).join(',').trim();
            
            // デバッグ用：日付が正しく認識されているかチェック
            if (isNaN(new Date(time).getTime())) {
                console.warn("日付として認識できませんでした:", time);
            }

            return { time: time, title: title, detail: detail };
        }).filter(item => item !== null); // null（空行）を除外

        console.log("変換後のスケジュール:", scheduleData);
        updateTimeKeeper();

    } catch (error) {
        console.error("スケジュールの読み込みに失敗しました:", error);
        document.getElementById('next-event').innerText = "データ読込エラー";
        document.getElementById('next-detail').innerText = "URLを確認してください";
    }
}

// --- 機能1: タブ切り替え ---
function switchTab(tabId) {
    const contents = document.querySelectorAll('.tab-content');
    contents.forEach(content => content.classList.remove('active'));
    
    const target = document.getElementById(tabId);
    if (target) target.classList.add('active');

    const buttons = document.querySelectorAll('.nav-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    
    // イベントが発生している場合のみスタイル適用
    if(typeof event !== 'undefined' && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }
}

// --- 機能2: スポット検索 ---
function filterSpots() {
    const input = document.getElementById('searchBox');
    if (!input) return;
    
    const filter = input.value.toUpperCase();
    const ul = document.getElementById('spotList');
    const li = ul.getElementsByTagName('li');

    for (let i = 0; i < li.length; i++) {
        const text = li[i].textContent || li[i].innerText;
        if (text.toUpperCase().indexOf(filter) > -1) {
            li[i].style.display = "";
        } else {
            li[i].style.display = "none";
        }
    }
}

// --- 機能3: タイムキーパー (詳細情報対応版) ---
function updateTimeKeeper() {
    if (scheduleData.length === 0) return;

    const now = new Date();
    const nextEventDisplay = document.getElementById('next-event');
    const nextDetailDisplay = document.getElementById('next-detail');
    const timeRemainingDisplay = document.getElementById('time-remaining');
    const statusLabel = document.getElementById('status-label');

    if (!nextEventDisplay) return;

    // 未来の予定を検索
    const nextItem = scheduleData.find(item => {
        return new Date(item.time).getTime() > now.getTime();
    });

    if (nextItem) {
        const eventTime = new Date(nextItem.time);
        const diffMs = eventTime - now; 
        
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHrs = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

        statusLabel.innerText = "NEXT SCHEDULE";
        nextEventDisplay.innerText = nextItem.title;
        
        // 詳細メモを表示
        if (nextDetailDisplay) {
            nextDetailDisplay.innerText = nextItem.detail || "";
        }

        // カウントダウン表示
        if (diffDays > 0) {
            timeRemainingDisplay.innerText = `あと ${diffDays}日 ${diffHrs}時間`;
            timeRemainingDisplay.style.color = "white";
        } else if (diffHrs > 0) {
            timeRemainingDisplay.innerText = `あと ${diffHrs}時間 ${diffMins}分`;
            timeRemainingDisplay.style.color = "white";
        } else {
            timeRemainingDisplay.innerText = `あと ${diffMins}分！`;
            timeRemainingDisplay.style.color = (diffMins < 30) ? "#ff4444" : "#ffd700";
        }
    } else {
        // 全予定終了時
        statusLabel.innerText = "INFORMATION";
        nextEventDisplay.innerText = "Enjoy Hokkaido!";
        if(nextDetailDisplay) nextDetailDisplay.innerText = "";
        timeRemainingDisplay.innerText = "全日程終了";
    }
}

// --- 起動処理 ---
document.addEventListener('DOMContentLoaded', function() {
    loadSchedule();
    setInterval(updateTimeKeeper, 60000);
});
