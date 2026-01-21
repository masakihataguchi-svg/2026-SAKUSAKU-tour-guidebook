// --- 設定：スケジュールデータ ---
// 【重要】iPhone対応のため、日付は「/」スラッシュ区切りにします
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
    // コンテンツの切り替え
    const contents = document.querySelectorAll('.tab-content');
    contents.forEach(content => {
        content.classList.remove('active');
    });
    const target = document.getElementById(tabId);
    if (target) {
        target.classList.add('active');
    }

    // ボタンのスタイル切り替え
    const buttons = document.querySelectorAll('.nav-btn');
    buttons.forEach(btn => {
        btn.classList.remove('active');
    });
    
    // クリックされたボタンをactiveにする
    // (eventが取得できる場合のみ実行する安全策)
    if(typeof event !== 'undefined' && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }
}

// --- 機能2: スポット検索 ---
function filterSpots() {
    const input = document.getElementById('searchBox');
    if (!input) return; // エラー防止
    
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

    // 要素が見つからない場合は処理を中断（エラー防止）
    if (!nextEventDisplay || !timeRemainingDisplay || !statusLabel) return;

    // 未来の予定を検索
    // 日付変換の互換性を高める記述
    const nextItem = scheduleData.find(item => {
        return new Date(item.time).getTime() > now.getTime();
    });

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

// 起動時に即実行
document.addEventListener('DOMContentLoaded', function() {
    updateTimeKeeper();
    setInterval(updateTimeKeeper, 60000);
});
// 念のためウィンドウ読み込み後にも実行
window.onload = updateTimeKeeper;
