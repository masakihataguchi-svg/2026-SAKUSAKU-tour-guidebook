// --- 設定：GoogleスプレッドシートのCSV URL ---
// ↓ここに取得した「ウェブに公開」のCSV用URLを貼り付けてください
const SHEET_CSV_URL = "ここにURLを貼り付け";

// スケジュールデータを格納する変数
let scheduleData = [];

// --- 機能0: データ読み込み (CSV Fetch) ---
async function loadSchedule() {
    try {
        const response = await fetch(SHEET_CSV_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const text = await response.text();
        
        // CSVをパースして配列にする
        // 1行目はヘッダー(Time, Title, Detail)なので削除
        const rows = text.trim().split('\n').slice(1);
        
        scheduleData = rows.map(row => {
            // カンマ区切りで配列化
            const columns = row.split(',');
            
            // 1列目: 時間
            const time = columns[0].trim();
            
            // 2列目: タイトル
            // (もしデータがなければ空文字)
            const title = columns[1] ? columns[1].trim() : "";
            
            // 3列目: 詳細メモ (乗り換え情報など)
            // ※もしメモの中にカンマが含まれていた場合の対策として、
            // 2列目以降をすべて結合してメモとして扱うようにしています。
            const detail = columns.slice(2).join(',').trim();
            
            return { time: time, title: title, detail: detail };
        });

        console.log("スケジュール読み込み完了:", scheduleData);
        // 読み込み終わったら画面更新
        updateTimeKeeper();

    } catch (error) {
        console.error("スケジュールの読み込みに失敗しました:", error);
        document.getElementById('next-event').innerText = "読込エラー";
        document.getElementById('next-detail').innerText = "通信環境を確認してください";
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
    // データ未取得なら何もしない
    if (scheduleData.length === 0) return;

    const now = new Date();
    const nextEventDisplay = document.getElementById('next-event');
    const nextDetailDisplay = document.getElementById('next-detail');
    const timeRemainingDisplay = document.getElementById('time-remaining');
    const statusLabel = document.getElementById('status-label');

    if (!nextEventDisplay) return;

    // 未来の予定を検索
    // 日付変換して比較 (iPhone/Safari互換性のためDateパースに注意)
    const nextItem = scheduleData.find(item => {
        return new Date(item.time).getTime() > now.getTime();
    });

    if (nextItem) {
        const eventTime = new Date(nextItem.time);
        const diffMs = eventTime - now; 
        
        // 残り時間の計算
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHrs = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

        // 画面表示
        statusLabel.innerText = "NEXT SCHEDULE";
        nextEventDisplay.innerText = nextItem.title;
        
        // ★詳細メモがあれば表示
        if (nextDetailDisplay) {
            nextDetailDisplay.innerText = nextItem.detail || "";
        }

        // カウントダウン表示の分岐
        if (diffDays > 0) {
            timeRemainingDisplay.innerText = `あと ${diffDays}日 ${diffHrs}時間`;
            timeRemainingDisplay.style.color = "white";
        } else if (diffHrs > 0) {
            timeRemainingDisplay.innerText = `あと ${diffHrs}時間 ${diffMins}分`;
            timeRemainingDisplay.style.color = "white";
        } else {
            timeRemainingDisplay.innerText = `あと ${diffMins}分！`;
            // 30分切ったら赤くするなどの演出
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
    // 起動時にデータを読み込みに行く
    loadSchedule();
    
    // 1分ごとに表示更新
    setInterval(updateTimeKeeper, 60000);
});
