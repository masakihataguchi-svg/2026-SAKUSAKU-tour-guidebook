// スケジュールデータを格納する変数
let scheduleData = [];

// --- 機能0: データ読み込み (Config -> CSV Fetch) ---
async function loadSchedule() {
    console.log("★最新版JS読み込み成功: URL対応版★");
    try {
        const configResp = await fetch("config.json?t=" + new Date().getTime());
        if (!configResp.ok) throw new Error("config.jsonが見つかりません");
        
        const config = await configResp.json();
        const sheetUrl = config.sheetUrl;

        const csvResp = await fetch(sheetUrl + "&t=" + new Date().getTime());
        if (!csvResp.ok) throw new Error(`CSV読込エラー: ${csvResp.status}`);
        
        const text = await csvResp.text();
        const rows = text.trim().split('\n');
        
        scheduleData = rows.map(row => {
            if (!row || row.trim() === "") return null;
            
            const cleanRow = row.replace(/"/g, ''); 
            const columns = cleanRow.split(',');

            // 列ズレ対策
            let timeIndex = 0;
            if (columns[1] && columns[1].indexOf('2026') > -1) {
                timeIndex = 1; 
            }
            // そもそもデータがおかしい場合はスキップ
            if (columns[timeIndex] === undefined || columns[timeIndex].indexOf('2026') === -1) {
                return null;
            }

            const time = columns[timeIndex].trim();
            const title = columns[timeIndex + 1] ? columns[timeIndex + 1].trim() : "";
            const detail = columns[timeIndex + 2] ? columns[timeIndex + 2].trim() : "";
            
            // ★追加：4列目(D列)をURLとして取得
            // カンマを含むURL対策で sliceを使うか、単純にindex指定するか。
            // 念のため詳細メモ以降の結合ロジックから切り離して、index+3を狙い撃ちします。
            const url = columns[timeIndex + 3] ? columns[timeIndex + 3].trim() : "";
            
            return { time: time, title: title, detail: detail, url: url };
        }).filter(item => item !== null);

        updateTimeKeeper();
        renderScheduleList(); 

    } catch (error) {
        console.error("読込エラー:", error);
        document.getElementById('next-event').innerText = "読込エラー";
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
        
        // リスト側にもリンクがあればアイコンを表示する（お好みで）
        let linkIcon = item.url ? ` <a href="${item.url}" target="_blank" style="color:#0055a4;"><i class="fas fa-external-link-alt"></i></a>` : "";

        li.innerHTML = `<span class="time">${timePart}</span> ${item.title}${linkIcon}${detailHtml}`;
        ul.appendChild(li);
    });
}

// --- 機能2: タイムキーパー (URLボタン対応) ---
function updateTimeKeeper() {
    if (scheduleData.length === 0) return;

    const now = new Date();
    const nextEventDisplay = document.getElementById('next-event');
    const nextDetailDisplay = document.getElementById('next-detail');
    const timeRemainingDisplay = document.getElementById('time-remaining');
    const statusLabel = document.getElementById('status-label');
    const nextLinkBtn = document.getElementById('next-link'); // ★追加

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
        
        const timeString = nextItem.time.split(' ')[1] || '';
        nextEventDisplay.innerText = `${timeString} ${nextItem.title}`;
        
        if (nextDetailDisplay) nextDetailDisplay.innerText = nextItem.detail || "";

        // ★URLがあればボタンを表示、なければ非表示
        if (nextItem.url && nextItem.url.startsWith('http')) {
            nextLinkBtn.href = nextItem.url;
            nextLinkBtn.style.display = "inline-block";
            // URLの種類によって文言を変えるなど凝ることも可能ですが、一旦「リンクを開く」で統一
        } else {
            nextLinkBtn.style.display = "none";
        }

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
        if(nextLinkBtn) nextLinkBtn.style.display = "none";
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
