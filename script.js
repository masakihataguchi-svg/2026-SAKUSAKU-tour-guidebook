// --- 設定：スケジュールデータ ---
// 日付形式: YYYY/MM/DD HH:MM
const scheduleData = [
    { time: '2026/02/14 10:00', title: '🛬 新千歳空港 到着' },
    { time: '2026/02/14 13:00', title: '🍛 ランチ：スープカレー' },
    { time: '2026/02/14 15:00', title: '🏨 ホテルチェックイン' },
    { time: '2026/02/14 18:00', title: '🍺 夕食：サッポロビール園' },
    { time: '2026/02/15 09:00', title: '🚗 ホテル出発（小樽へ）' },
    { time: '2026/02/15 12:00', title: '🍣 ランチ：お寿司' },
    { time: '2026/02/16 16:00', title: '🛫 新千歳空港 出発' }
];

// --- 機能1: タブ切り替え ---
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(tabId).classList.add('active');

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    // eventが存在する場合のみクラス付与
    if(event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }
}

// --- 機能2: スポット検索 ---
function filterSpots() {
    const input = document.getElementById('searchBox');
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

// --- 機能3: タイムキーパー ---
function updateTimeKeeper() {
    const now = new Date();
    const nextEventDisplay = document.getElementById('next-event');
    const timeRemainingDisplay = document.getElementById('time-remaining');
    const statusLabel = document.getElementById('status-label');

    // 未来の予定を検索
    // 日付比較のためDateオブジェクトに変換して比較
    const nextItem = scheduleData.find(item => new Date(item.time) > now);

    if (nextItem) {
        const eventTime = new Date(nextItem.time);
        const diffMs = eventTime - now; 
        
        // 差分計算
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHrs = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

        statusLabel.innerText = "NEXT SCHEDULE";
        nextEventDisplay.innerText = nextItem.title;

        // 表示パターンの分岐
        if (diffDays > 0) {
            timeRemainingDisplay.innerText = `あと ${diffDays}日 ${diffHrs}時間`;
        } else if (diffHrs > 0) {
            timeRemainingDisplay.innerText = `あと ${diffHrs}時間 ${diffMins}分`;
        } else {
            timeRemainingDisplay.innerText = `あと ${diffMins}分！`;
            timeRemainingDisplay.style.color = (diffMins < 30) ? "#ff4444" : "#ffd700";
        }
    } else {
        // 全予定終了後の表示
        statusLabel.innerText = "INFORMATION";
        nextEventDisplay.innerText = "Enjoy Hokkaido!";
        timeRemainingDisplay.innerText = "全日程終了";
    }
}

// 1分ごとに更新＆初回実行
setInterval(updateTimeKeeper, 60000);
updateTimeKeeper();
