// スケジュールデータを格納する変数
let scheduleData = [];

// --- 機能0: データ読み込み (Config -> CSV Fetch) ---
async function loadSchedule() {
    console.log("★最新版JS読み込み成功: モーダル対応版★");
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

            // 列の特定ロジック
            let tIdx = 0;
            if (columns[1] && columns[1].indexOf('2026') > -1) {
                tIdx = 1; 
            }
            if (columns[tIdx] === undefined || columns[tIdx].indexOf('2026') === -1) {
                return null;
            }

            const time = columns[tIdx].trim();
            const title = columns[tIdx + 1] ? columns[tIdx + 1].trim() : "";
            const detail = columns[tIdx + 2] ? columns[tIdx + 2].trim() : "";
            const webDesc = columns[tIdx + 3] ? columns[tIdx + 3].trim() : "";
            const webUrl  = columns[tIdx + 4] ? columns[tIdx + 4].trim() : "";
            const imgDesc = columns[tIdx + 5] ? columns[tIdx + 5].trim() : "";
            const imgUrl  = columns[tIdx + 6] ? columns[tIdx + 6].trim() : "";
            
            return { time, title, detail, webDesc, webUrl, imgDesc, imgUrl };
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
        let linkIcon = "";
        if (item.webUrl && item.webUrl.startsWith('http')) {
            linkIcon = ` <a href="${item.webUrl}" target="_blank" style="color:#0055a4; margin-left:5px;"><i class="fas fa-external-link-alt"></i></a>`;
        }

        li.innerHTML = `<span class="time">${timePart}</span> ${item.title}${linkIcon}${detailHtml}`;
        ul.appendChild(li);
    });
}

// --- 機能2: タイムキーパー (3ブロック & モーダル対応) ---
function updateTimeKeeper() {
    if (scheduleData.length === 0) return;

    const now = new Date();
    
    // 要素の取得
    const nextEventDisplay = document.getElementById('next-event');
    const nextDetailDisplay = document.getElementById('next-detail');
    const timeRemainingDisplay = document.getElementById('time-remaining');
    
    // Webブロック
    const webContainer = document.getElementById('web-link-container');
    const webDescDisplay = document.getElementById('web-desc');
    const webLinkBtn = document.getElementById('web-link-btn');
    const webLinkText = document.getElementById('web-link-text');

    // 画像ブロック
    const imageContainer = document.getElementById('image-container');
    const imageDescDisplay = document.getElementById('image-desc');
    const mediaContent = document.getElementById('media-content');

    if (!nextEventDisplay) return;

    const nextItem = scheduleData.find(item => {
        return new Date(item.time).getTime() > now.getTime();
    });

    // 初期化
    webContainer.style.display = "none";
    imageContainer.style.display = "none";
    mediaContent.innerHTML = "";

    if (nextItem) {
        const eventTime = new Date(nextItem.time);
        const diffMs = eventTime - now; 
        
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHrs = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

        // 1. スケジュール情報
        const timeString = nextItem.time.split(' ')[1] || '';
        nextEventDisplay.innerText = `${timeString} ${nextItem.title}`;
        nextDetailDisplay.innerText = nextItem.detail || "";

        // 2. Web情報
        if (nextItem.webUrl && nextItem.webUrl.startsWith('http')) {
            webContainer.style.display = "block";
            webLinkBtn.href = nextItem.webUrl;
            webDescDisplay.innerText = nextItem.webDesc || "Webサイト";
            webLinkText.innerText = "Webサイトを開く";
        }

        // 3. 画像情報
        if (nextItem.imgUrl && nextItem.imgUrl.startsWith('http')) {
            imageContainer.style.display = "block";
            imageDescDisplay.innerText = nextItem.imgDesc || "画像情報";

            // Googleドライブ判定
            const driveMatch = nextItem.imgUrl.match(/\/d\/(.+?)\//);
            let imgSrc = nextItem.imgUrl;
            if (driveMatch) {
                // ★修正：Safari対応のため、GoogleのサムネイルAPIを使用します
                // sz=s4000 は「長辺4000px」の意味。これで高画質のまま表示できます。
                imgSrc = `https://drive.google.com/thumbnail?id=${driveMatch[1]}&sz=s4000`;
            }

            // 画像生成 (クリックでモーダルを開くイベント追加)
            // onclickで openModal を呼び出し、引数に画像のURLと説明を渡す
            mediaContent.innerHTML = `<img src="${imgSrc}" class="event-image" alt="Event Image" onclick="openModal('${imgSrc}', '${nextItem.imgDesc}')">`;
        }

        // カウントダウン
        if (diffDays > 0) {
            timeRemainingDisplay.innerText = `あと ${diffDays}日 ${diffHrs}時間`;
        } else if (diffHrs > 0) {
            timeRemainingDisplay.innerText = `あと ${diffHrs}時間 ${diffMins}分`;
        } else {
            timeRemainingDisplay.innerText = `あと ${diffMins}分！`;
            timeRemainingDisplay.style.color = (diffMins < 30) ? "#ff4444" : "#ffd700";
        }
    } else {
        nextEventDisplay.innerText = "Enjoy Hokkaido!";
        nextDetailDisplay.innerText = "全日程終了";
        timeRemainingDisplay.innerText = "";
    }
}

// --- 機能3: モーダル (画像拡大) ---
function openModal(src, caption) {
    const modal = document.getElementById("image-modal");
    const modalImg = document.getElementById("modal-img");
    const captionText = document.getElementById("caption");
    
    modal.style.display = "block";
    modalImg.src = src;
    captionText.innerText = caption || "";
    
    // ズーム状態をリセット
    modalImg.classList.remove("zoomed");
}

function closeModal() {
    document.getElementById("image-modal").style.display = "none";
}

// モーダル内の画像をタップした時の処理（ズーム切り替え）
// ※画像のクリックイベントが closeModal に吸われないように stopPropagation する
document.getElementById("modal-img").addEventListener('click', function(e) {
    e.stopPropagation(); // 親要素(modal)への伝播を止める
    this.classList.toggle("zoomed"); // ズームクラスを付け外し
});


// --- 共通機能 ---
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    if(typeof event !== 'undefined' && event.currentTarget) event.currentTarget.classList.add('active');
}

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

document.addEventListener('DOMContentLoaded', function() {
    loadSchedule();
    setInterval(updateTimeKeeper, 60000);
});
