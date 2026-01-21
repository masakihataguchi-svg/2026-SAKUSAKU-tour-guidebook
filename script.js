// スケジュールデータを格納する変数
let scheduleData = [];

// --- 機能0: データ読み込み (Config -> CSV Fetch) ---
async function loadSchedule() {
    try {
        // ステップ1: 設定ファイル(config.json)からURLを取得
        // ※キャッシュ対策で時刻パラメータを付与
        const configResp = await fetch("config.json?t=" + new Date().getTime());
        if (!configResp.ok) throw new Error("config.jsonが見つかりません");
        
        const config = await configResp.json();
        const sheetUrl = config.sheetUrl;

        if (!sheetUrl) throw new Error("URLが設定されていません");

        // ステップ2: 取得したURLを使ってCSVデータを取得
        const csvResp = await fetch(sheetUrl + "&t=" + new Date().getTime());
        if (!csvResp.ok) throw new Error(`CSV読込エラー: ${csvResp.status}`);
        
        const text = await csvResp.text();
        console.log("Raw CSV:", text.substring(0, 100) + "..."); 

        // CSVパース処理
        const rows = text.trim().split('\n').slice(1);
        
        scheduleData = rows.map(row => {
            if (!row || row.trim() === "") return null;
            
            const cleanRow = row.replace(/"/g, ''); 
            const columns = cleanRow.split(',');

            // 列ズレ対策
            let timeIndex = 0;
            if (columns[1] && columns[1].indexOf('2026') > -1) {
                timeIndex = 1; 
            }

            const time = columns[timeIndex] ? columns[timeIndex].trim() : "";
            const title = columns[timeIndex + 1] ? columns[timeIndex + 1].trim() : "";
            const detail = columns.slice(timeIndex + 2).join(',').trim();
            
            return { time: time, title: title, detail: detail };
        }).filter(item => item !== null && item.time.indexOf('2026') > -1);

        console.log("Parsed Data:", scheduleData);
        
        updateTimeKeeper();
        renderScheduleList(); 

    } catch (error) {
        console.error("読込エラー:", error);
        document.getElementById('next-event').innerText = "読込エラー";
        // エラー内容を詳細エリアに表示（デバッグしやすくするため）
        const detailElem = document.getElementById('next-detail');
        if(detailElem) detailElem.innerText = error.message;
    }
}

// --- 機能1: 日程表リストの描画 ---
function renderScheduleList() {
    const container = document.querySelector('#schedule .timeline');
    if (!container || scheduleData.length === 0) return;

    container.innerHTML = '';

    let currentDayStr = "";
    const firstDateObj = new Date(scheduleData[0].time.split(' ')[0]);

    scheduleData.forEach(item => {
        const datePart = item.time.split(' ')[0];
        const timePart = item.time.split(' ')[1] || "";

        if (datePart !== currentDayStr) {
            currentDayStr = datePart;
            
            const thisDateObj = new Date(datePart);
            const diffTime = Math.abs(thisDateObj - firstDateObj);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; 
            const formattedDate = `${thisDateObj.getMonth() + 1}/${thisDateObj.getDate()}`;

            const dayCard = document.createElement('div');
            dayCard.className = 'day-card';
            dayCard.innerHTML = `<h3>Day ${diffDays} (${formattedDate})</h3><ul></ul>`;
            container.appendChild(dayCard);
        }

        const ul = container.lastElementChild.querySelector('ul');
        const li = document.createElement('li');
        let detailHtml = item.detail ? `<br><span style="font-size:0.8em; color:#666;">${item.detail}</span>` : "";
        li.innerHTML = `<span class="time">${timePart}</span> ${item.title}${detailHtml}`;
        ul.appendChild(li);
    });
}

// --- 機能2: タイムキーパー ---
function updateTimeKeeper() {
    if (scheduleData.length === 0) return;

    const now = new Date();
    const nextEventDisplay = document.getElementById('next-event');
    const nextDetailDisplay = document.getElementById('next-detail');
    const timeRemainingDisplay = document.getElementById('time-remaining');
    const statusLabel = document.getElementById('status-label');

    if (!nextEventDisplay) return;

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
        if (nextDetailDisplay) nextDetailDisplay.innerText = nextItem.detail || "";

        if (diffDays > 0) {
            timeRemainingDisplay.innerText = `あと ${diffDays}日 ${diffHrs}時間`;
        } else if (diffHrs > 0) {
            timeRemainingDisplay.innerText = `あと ${diffHrs}時間 ${diffMins}分`;
        } else {
            timeRemainingDisplay.innerText = `あと ${diffMins}分！`;
            timeRemainingDisplay.style.color = (diffMins < 30) ? "#ff4444" : "#ffd700";
        }
    } else {
        statusLabel.innerText = "INFORMATION";
        nextEventDisplay.innerText = "Enjoy Hokkaido!";
        if(nextDetailDisplay) nextDetailDisplay.innerText = "";
        timeRemainingDisplay.innerText = "全日程終了";
    }
}

// --- 機能3: タブ切り替え ---
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    if(typeof event !== 'undefined' && event.currentTarget) event.currentTarget.classList.add('active');
}

// --- 機能4: スポット検索 ---
function filterSpots() {
    const input = document.getElementById('searchBox');
    if (!input) return;
    const filter = input.value.toUpperCase();
    const li = document.getElementById('spotList').getElementsByTagName('li');
    for (let i = 0; i < li.length; i++) {
        const text = li[i].textContent || li[i].innerText;
        li[i].style.display = (text.toUpperCase().indexOf(filter) > -1) ? "" : "none";
    }
}

// --- 起動処理 ---
document.addEventListener('DOMContentLoaded', function() {
    loadSchedule();
    setInterval(updateTimeKeeper, 60000);
});
