const lifeosToken = localStorage.getItem('lifeos-token');
if (!lifeosToken) window.location.href = '/login.html';

const originalFetch = window.fetch;
window.fetch = async function () {
  let [resource, config] = arguments;
  if (!config) config = {};
  if (!config.headers) config.headers = {};
  config.headers['Authorization'] = `Bearer ${lifeosToken}`;
  
  const response = await originalFetch(resource, config);
  if (response.status === 401) {
    localStorage.removeItem('lifeos-token');
    window.location.href = '/login.html';
  }
  return response;
};

function logout() {
  localStorage.clear();
  window.location.href = '/login.html';
}

// Inactivity Timeout (10 minutes)
let inactivityTimer;
function resetInactivity() {
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(logout, 10 * 60 * 1000);
}
['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(e => 
  document.addEventListener(e, resetInactivity)
);
resetInactivity();

// ═══════════════ STATE ═══════════════
const COLORS = {
  terracotta: { bg: '#F7EDE6', fill: '#C96A3C', text: '#8A3A1A' },
  forest:     { bg: '#E6F0EA', fill: '#3D6B4F', text: '#1A4A2A' },
  sky:        { bg: '#E6EFF5', fill: '#3A6B8A', text: '#1A3A55' },
  gold:       { bg: '#F5EFE0', fill: '#B8923A', text: '#7A5A15' },
  rose:       { bg: '#F5E6EC', fill: '#B84A6A', text: '#7A2040' },
};

const CAT_EMOJI = {
  'Food & Dining':'🍔','Transport':'🚗','Shopping':'🛍','Bills & Utilities':'💡',
  'Health':'💊','Entertainment':'🎬','Investment':'📈','Salary':'💼',
  'Freelance':'💻','Trading P&L':'📊','Other':'💰'
};

const CAT_COLOR = {
  'Food & Dining':'terracotta','Transport':'sky','Shopping':'rose',
  'Bills & Utilities':'gold','Health':'forest','Entertainment':'rose',
  'Investment':'forest','Salary':'forest','Freelance':'sky',
  'Trading P&L':'gold','Other':'sky'
};

const TAG_COLORS = {
  'Job Hunt':'sky','Trading':'gold','Learning':'forest','Personal':'rose',
  'Finance':'forest','Health':'forest','Projects':'terracotta','Other':'sky'
};

let txnFilter = 'all';

let localS = JSON.parse(localStorage.getItem('lifeOS_v3_local')) || {
  budgets: [],
  calYear: new Date().getFullYear(),
  calMonth: new Date().getMonth(),
  selectedDate: fmtDate(new Date()),
};

let S = {
  transactions: [],
  goals: [],
  tasks: [],
  habits: [],
  events: [],
  meals: [],
  water: {},
  calorieGoal: 2000,
  dietDate: fmtDate(new Date()),
  budgets: localS.budgets,
  calYear: localS.calYear,
  calMonth: localS.calMonth,
  selectedDate: localS.selectedDate
};


function saveLocal() {
  localStorage.setItem('lifeOS_v3_local', JSON.stringify({
    budgets: S.budgets,
    calYear: S.calYear,
    calMonth: S.calMonth,
    selectedDate: S.selectedDate
  }));
}

function fmtDate(d) { return d.toISOString().split('T')[0]; }
function nextWeekday(dayOfWeek) {
  const d = new Date();
  const diff = (dayOfWeek - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return fmtDate(d);
}

const WEEKDAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
function todayIdx() {
  const d = new Date().getDay();
  return d === 0 ? 6 : d - 1; // Mon=0, Sun=6
}

function getWeekDates() {
  const dates = [];
  const now = new Date();
  const monStart = new Date(now);
  monStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  for(let i=0; i<7; i++) {
    const d = new Date(monStart);
    d.setDate(monStart.getDate() + i);
    dates.push(fmtDate(d));
  }
  return dates;
}

// ═══════════════ API INTEGRATION ═══════════════

async function loadData() {
  try {
    const [txns, goals, tasks, habits, events, meals, water, settings] = await Promise.all([
      fetch('/api/transactions').then(r=>r.json()),
      fetch('/api/goals').then(r=>r.json()),
      fetch('/api/tasks').then(r=>r.json()),
      fetch('/api/habits').then(r=>r.json()),
      fetch('/api/events').then(r=>r.json()),
      fetch('/api/diet').then(r=>r.json()),
      fetch('/api/water').then(r=>r.json()),
      fetch('/api/settings').then(r=>r.json())
    ]);
    
    S.transactions = txns || [];
    S.goals = goals || [];
    S.tasks = tasks || [];
    S.events = events || [];
    S.meals = meals || [];
    S.water = water || {};
    S.calorieGoal = parseInt(settings.calorieGoal) || 2000;
    
    // Map habits logs
    const weekDates = getWeekDates();
    S.habits = (habits || []).map(h => {
      const week = weekDates.map(d => h.logs[d] ? 1 : 0);
      return { ...h, week };
    });
    
    renderAll();
  } catch (err) {
    console.error("Failed to load data", err);
  }
}


async function apiCall(url, method, body) {
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    await loadData();
    return await res.json();
  } catch (err) {
    console.error("API Error", err);
    toast('Server error', '⚠');
  }
}

// ═══════════════ TOAST ═══════════════
function toast(msg, icon='✓') {
  const el = document.getElementById('toast');
  document.getElementById('toast-icon').textContent = icon + ' ';
  document.getElementById('toast-msg').textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2600);
}

// ═══════════════ NAVIGATION ═══════════════
function switchTab(tab) {
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  document.querySelector(`.nav-btn[data-tab="${tab}"]`).classList.add('active');
  renderAll();
}

// ═══════════════ MODAL ═══════════════
function openModal(id) {
  document.getElementById(id).classList.add('open');
  const today = fmtDate(new Date());
  const dateInput = document.querySelector(`#${id} input[type="date"]`);
  if (dateInput && !dateInput.value) dateInput.value = today;
}
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.modal-overlay').forEach(o => {
  o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open'); });
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
});

// ═══════════════ SIDEBAR DATE ═══════════════
function renderSidebarDate() {
  const d = new Date();
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  document.getElementById('sb-weekday').textContent = days[d.getDay()].toUpperCase();
  document.getElementById('sb-date').textContent = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// ═══════════════ OVERVIEW ═══════════════
function renderOverview() {
  const d = new Date();
  const hr = d.getHours();
  const greet = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('ov-greeting').innerHTML = `${greet}, <em>Viswam.</em>`;
  document.getElementById('ov-meta').textContent = `${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()]} · ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;

  // Stats
  const income = S.transactions.filter(t=>t.type==='income').reduce((a,t)=>a+t.amount,0);
  const expense = S.transactions.filter(t=>t.type==='expense').reduce((a,t)=>a+t.amount,0);
  const doneTasks = S.tasks.filter(t=>t.status==='done').length;
  const todayHabits = S.habits.filter(h=>h.week[todayIdx()]).length;
  const net = income - expense;

  document.getElementById('ov-stats').innerHTML = `
    ${statCard('Balance', fmt(net), net>=0?'delta-up':'delta-down', net>=0?'↑ net positive':'↓ net negative', 'forest', 'rupee')}
    ${statCard('Expenses', fmt(expense), 'delta-down', '↓ total spent', 'terracotta', '')}
    ${statCard('Tasks Done', `${doneTasks}/${S.tasks.length}`, 'delta-up', '✓ completed', 'sky', '')}
    ${statCard('Habits Today', `${todayHabits}/${S.habits.length}`, 'delta-up', '⟳ checked in', 'rose', '')}
  `;

  // Txns
  const txnHtml = S.transactions.slice(0,4).map(t => txnRow(t)).join('');
  document.getElementById('ov-txns').innerHTML = txnHtml || emptyState('💸', 'No transactions yet');

  // Tasks
  const todayStr = fmtDate(new Date());
  const todayTasks = S.tasks.filter(t => t.due === todayStr || (t.status !== 'done' && !t.due)).slice(0,4);
  document.getElementById('ov-tasks').innerHTML = todayTasks.map(t => `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
      <div style="width:8px;height:8px;border-radius:50%;flex-shrink:0;background:${t.priority==='high'?'#C53030':t.priority==='medium'?'var(--gold)':'var(--forest)'}"></div>
      <div style="flex:1;font-size:13px;${t.status==='done'?'text-decoration:line-through;color:var(--muted)':''}">${t.title}</div>
      <span class="chip" style="background:${COLORS[TAG_COLORS[t.tag]||'sky'].bg};color:${COLORS[TAG_COLORS[t.tag]||'sky'].text}">${t.tag}</span>
    </div>
  `).join('') || emptyState('✦', 'No tasks for today');

  // Events
  const upcoming = S.events.filter(e=>e.date >= fmtDate(new Date())).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,3);
  document.getElementById('ov-events').innerHTML = upcoming.map(e => `
    <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border)">
      <div style="width:4px;height:32px;border-radius:100px;background:${COLORS[e.color].fill};flex-shrink:0"></div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:500">${e.title}</div>
        <div style="font-size:11px;color:var(--muted);font-family:'JetBrains Mono',monospace">${e.date}${e.time?' · '+e.time:''}</div>
      </div>
    </div>
  `).join('') || emptyState('▦', 'No upcoming events');

  // Goals
  document.getElementById('ov-goals').innerHTML = S.goals.slice(0,3).map(g => {
    const pct = Math.min(100, Math.round(g.current/g.target*100));
    return `<div style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <div style="font-size:13px;font-weight:500">${g.emoji} ${g.name}</div>
        <div style="font-size:11px;font-family:'JetBrains Mono',monospace;color:var(--muted)">${pct}%</div>
      </div>
      <div class="goal-track"><div class="goal-fill" style="width:${pct}%;background:${COLORS[g.color].fill}"></div></div>
    </div>`;
  }).join('') || emptyState('◎', 'No goals yet');

  // Habits overview
  document.getElementById('ov-habits').innerHTML = S.habits.slice(0,5).map(h => {
    const done = h.week[todayIdx()];
    return `<div style="display:flex;align-items:center;gap:12px;padding:9px 0;border-bottom:1px solid var(--border)">
      <div style="width:32px;height:32px;border-radius:9px;background:${COLORS[h.color].bg};display:flex;align-items:center;justify-content:center;font-size:16px">${h.emoji}</div>
      <div style="flex:1;font-size:13px;font-weight:500">${h.name}</div>
      <div style="width:28px;height:28px;border-radius:8px;background:${done?COLORS[h.color].fill:'var(--surface2)'};border:1.5px solid ${done?COLORS[h.color].fill:'var(--border-dark)'};display:flex;align-items:center;justify-content:center;color:${done?'white':'var(--muted-light)'};font-size:12px;cursor:pointer" onclick="toggleHabitToday(${h.id})">${done?'✓':'○'}</div>
    </div>`;
  }).join('') || emptyState('⟳', 'No habits yet');

  // Nutrition overview
  const todayStr2 = fmtDate(new Date());
  const todayFoods = S.meals.filter(m => m.date === todayStr2);
  const todayCal  = todayFoods.reduce((a,m) => a + m.calories, 0);
  const todayProt = todayFoods.reduce((a,m) => a + (m.protein||0), 0);
  const todayCarb = todayFoods.reduce((a,m) => a + (m.carbs||0), 0);
  const todayFat  = todayFoods.reduce((a,m) => a + (m.fat||0), 0);
  const calPct    = Math.min(100, Math.round(todayCal / S.calorieGoal * 100));
  const ovDiet    = document.getElementById('ov-diet');
  if (ovDiet) ovDiet.innerHTML = `
    <div style="display:flex;gap:16px;margin-bottom:14px">
      ${[['Calories','kcal',todayCal,'#C96A3C'],['Protein','g',todayProt,'#3D6B4F'],['Carbs','g',todayCarb,'#B8923A'],['Fat','g',todayFat,'#B84A6A']].map(([n,u,v,c])=>`
        <div style="flex:1;text-align:center">
          <div style="font-size:18px;font-weight:700;font-family:'Playfair Display',serif;color:${c}">${Math.round(v)}</div>
          <div style="font-size:9px;color:var(--muted);font-family:'JetBrains Mono',monospace;letter-spacing:0.5px;text-transform:uppercase">${n}</div>
        </div>
      `).join('')}
    </div>
    <div class="budget-track" style="height:8px"><div class="budget-fill" style="width:${calPct}%;background:var(--terracotta)"></div></div>
    <div style="font-size:11px;font-family:'JetBrains Mono',monospace;color:var(--muted);margin-top:6px">${todayCal} / ${S.calorieGoal} kcal · ${todayFoods.length} items logged</div>
  `;

  // Water overview
  const wFilled = S.water[fmtDate(new Date())] || 0;
  const ovWater = document.getElementById('ov-water');
  if (ovWater) ovWater.innerHTML = `
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
      ${Array.from({length:8},(_,i)=>`<div style="width:32px;height:32px;border-radius:8px;background:${i<wFilled?'var(--sky)':'var(--surface2)'};border:1.5px solid ${i<wFilled?'var(--sky)':'var(--border-dark)'};display:flex;align-items:center;justify-content:center;font-size:15px;cursor:pointer" onclick="toggleWaterOverview(${i})">💧</div>`).join('')}
    </div>
    <div style="font-size:12px;font-family:'JetBrains Mono',monospace;color:var(--muted)">${wFilled * 250}ml / 2000ml consumed</div>
  `;
}


function statCard(label, value, deltaClass, deltaText, color, _) {
  return `<div class="stat-card">
    <div class="stat-accent-bar" style="background:${COLORS[color].fill}"></div>
    <div class="stat-label">${label}</div>
    <div class="stat-value">${value}</div>
    <div class="stat-delta ${deltaClass}">${deltaText}</div>
  </div>`;
}

function fmt(n) {
  return '₹' + Math.abs(n).toLocaleString('en-IN');
}

function emptyState(icon, text) {
  return `<div class="empty"><div class="empty-icon">${icon}</div><div class="empty-text">${text}</div></div>`;
}

// ═══════════════ FINANCE ═══════════════
async function addTransaction() {
  const desc = document.getElementById('txn-desc').value.trim();
  const amount = parseFloat(document.getElementById('txn-amount').value);
  const type = document.getElementById('txn-type').value;
  const cat = document.getElementById('txn-cat').value;
  const date = document.getElementById('txn-date').value;
  if (!desc || !amount || !date) return toast('Please fill all fields', '⚠');
  
  await apiCall('/api/transactions', 'POST', { desc, amount, type, cat, date });
  closeModal('m-txn'); toast('Transaction added!');
  ['txn-desc','txn-amount'].forEach(id => document.getElementById(id).value='');
}

function deleteTxn(id) { apiCall('/api/transactions/'+id, 'DELETE').then(()=>toast('Removed','🗑')); }

function setTxnFilter(filter, btn) {
  txnFilter = filter;
  document.querySelectorAll('.seg-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderFinance();
}

function txnRow(t) {
  const c = COLORS[CAT_COLOR[t.cat] || 'sky'];
  return `<div class="txn-row">
    <div class="txn-dot" style="background:${c.bg}">${CAT_EMOJI[t.cat]||'💰'}</div>
    <div class="txn-info">
      <div class="txn-name">${t.desc}</div>
      <div class="txn-meta">${t.cat} · ${t.date}</div>
    </div>
    <div class="txn-amount ${t.type}">${t.type==='income'?'+':'-'}${fmt(t.amount)}</div>
    <button class="del-btn" onclick="deleteTxn(${t.id})">×</button>
  </div>`;
}

function renderFinance() {
  const income = S.transactions.filter(t=>t.type==='income').reduce((a,t)=>a+t.amount,0);
  const expense = S.transactions.filter(t=>t.type==='expense').reduce((a,t)=>a+t.amount,0);
  const net = income - expense;
  document.getElementById('nb-finance').textContent = S.transactions.length;

  document.getElementById('fin-stats').innerHTML = `
    ${statCard('Total Income', fmt(income), 'delta-up', `↑ ${S.transactions.filter(t=>t.type==='income').length} entries`, 'forest', '')}
    ${statCard('Total Expenses', fmt(expense), 'delta-down', `↓ ${S.transactions.filter(t=>t.type==='expense').length} entries`, 'terracotta', '')}
    ${statCard('Net Balance', fmt(net), net>=0?'delta-up':'delta-down', net>=0?'↑ positive cashflow':'↓ negative cashflow', net>=0?'forest':'rose', '')}
    ${statCard('Transactions', S.transactions.length, 'delta-up', 'total recorded', 'sky', '')}
  `;

  const filtered = txnFilter === 'all' ? S.transactions : S.transactions.filter(t=>t.type===txnFilter);
  document.getElementById('fin-txns').innerHTML = filtered.map(t=>txnRow(t)).join('') || emptyState('💸','No transactions');

  const catSpend = {};
  S.transactions.filter(t=>t.type==='expense').forEach(t => catSpend[t.cat]=(catSpend[t.cat]||0)+t.amount);
  const maxSpend = Math.max(...Object.values(catSpend), 1);
  const catColors = ['terracotta','sky','rose','gold','forest'];
  document.getElementById('fin-cats').innerHTML = Object.entries(catSpend).sort((a,b)=>b[1]-a[1]).map(([cat,amt],i) => `
    <div class="cat-bar">
      <div class="cat-label">${cat}</div>
      <div class="cat-track"><div class="cat-fill" style="width:${Math.round(amt/maxSpend*100)}%;background:${COLORS[catColors[i%5]].fill}"></div></div>
      <div class="cat-val">${fmt(amt)}</div>
    </div>
  `).join('') || '<div class="text-muted" style="font-family:\\\'JetBrains Mono\\\',monospace;font-size:12px">No expense data</div>';

  document.getElementById('fin-budgets').innerHTML = S.budgets.map(b => {
    const spent = S.transactions.filter(t=>t.type==='expense'&&t.cat===b.cat).reduce((a,t)=>a+t.amount,0);
    const pct = Math.min(100, Math.round(spent/b.limit*100));
    const over = spent > b.limit;
    return `<div class="budget-item">
      <div class="budget-header">
        <div class="budget-name">${CAT_EMOJI[b.cat]||''} ${b.cat}</div>
        <div class="budget-nums" style="color:${over?'#C53030':'var(--muted)'}">${fmt(spent)} / ${fmt(b.limit)}</div>
      </div>
      <div class="budget-track"><div class="budget-fill" style="width:${pct}%;background:${over?'#C53030':COLORS[b.color].fill}"></div></div>
    </div>`;
  }).join('');
}

// ═══════════════ GOALS ═══════════════
async function addGoal() {
  const emoji = document.getElementById('goal-emoji').value.trim() || '🎯';
  const name = document.getElementById('goal-name').value.trim();
  const target = parseFloat(document.getElementById('goal-target').value);
  const current = parseFloat(document.getElementById('goal-current').value) || 0;
  const deadline = document.getElementById('goal-deadline').value;
  const color = document.getElementById('goal-color').value;
  if (!name || !target) return toast('Fill in name and target', '⚠');
  
  await apiCall('/api/goals', 'POST', { emoji, name, target, current, deadline, color });
  closeModal('m-goal'); toast('Goal created! 🎯');
  ['goal-emoji','goal-name','goal-target','goal-current','goal-deadline'].forEach(id=>document.getElementById(id).value='');
}

function updateGoalProgress(id, val) {
  const g = S.goals.find(g=>g.id===id);
  if (!g || !val) return;
  const current = Math.min(g.target, g.current + parseFloat(val));
  apiCall('/api/goals/'+id, 'PUT', { current }).then(()=>toast('Progress updated!'));
}

function deleteGoal(id) { apiCall('/api/goals/'+id, 'DELETE').then(()=>toast('Goal removed','🗑')); }

function renderGoals() {
  document.getElementById('nb-goals').textContent = S.goals.length;
  document.getElementById('goals-grid').innerHTML = S.goals.map(g => {
    const pct = Math.min(100, Math.round(g.current/g.target*100));
    const daysLeft = g.deadline ? Math.ceil((new Date(g.deadline)-new Date())/(1000*60*60*24)) : null;
    const statusLabel = pct>=100?'Completed':daysLeft!==null&&daysLeft<7?'Due soon':'Active';
    const statusColor = pct>=100?'forest':daysLeft!==null&&daysLeft<7?'terracotta':'sky';
    const c = COLORS[g.color];
    return `<div class="goal-card">
      <button class="del-btn" style="position:absolute;top:14px;right:14px;opacity:0" onclick="deleteGoal(${g.id})">×</button>
      <div class="goal-top">
        <div style="font-size:36px;line-height:1">${g.emoji}</div>
        <div class="goal-badge" style="background:${COLORS[statusColor].bg};color:${COLORS[statusColor].text}">${statusLabel}</div>
      </div>
      <div class="goal-title">${g.name}</div>
      ${g.deadline?`<div class="goal-deadline">📅 ${g.deadline}${daysLeft!==null?' · '+daysLeft+' days left':''}</div>`:``}
      <div class="goal-progress">
        <div class="goal-progress-nums">
          <span>${g.current.toLocaleString('en-IN')} / ${g.target.toLocaleString('en-IN')}</span>
          <span style="color:${c.fill};font-weight:600">${pct}%</span>
        </div>
        <div class="goal-track"><div class="goal-fill" style="width:${pct}%;background:${c.fill}"></div></div>
      </div>
      <div class="goal-actions">
        <input type="number" class="goal-input" id="goal-add-${g.id}" placeholder="Add progress..." min="0">
        <button class="btn btn-sm" style="background:${c.fill};color:white" onclick="updateGoalProgress(${g.id}, document.getElementById('goal-add-${g.id}').value)">Add</button>
      </div>
    </div>`;
  }).join('') || `<div style="grid-column:1/-1">${emptyState('◎','No goals yet. Create your first one!')}</div>`;
}

// ═══════════════ TASKS ═══════════════
const STATUSES = [
  { key:'todo', label:'To Do', dot:'#E53E3E' },
  { key:'in-progress', label:'In Progress', dot:'#B8923A' },
  { key:'done', label:'Done', dot:'#3D6B4F' },
];

async function addTask() {
  const title = document.getElementById('task-title').value.trim();
  const priority = document.getElementById('task-priority').value;
  const tag = document.getElementById('task-tag').value;
  const due = document.getElementById('task-due').value;
  if (!title) return toast('Enter a task description', '⚠');
  
  await apiCall('/api/tasks', 'POST', { title, status:'todo', priority, tag, due });
  closeModal('m-task'); toast('Task added! ✦');
  document.getElementById('task-title').value='';
}

function moveTask(id, status) {
  apiCall('/api/tasks/'+id, 'PUT', { status }).then(()=>toast('Task moved!'));
}

function deleteTask(id) { apiCall('/api/tasks/'+id, 'DELETE').then(()=>toast('Task removed','🗑')); }

function renderTasks() {
  document.getElementById('nb-tasks').textContent = S.tasks.filter(t=>t.status!=='done').length;
  const prioColor = { high:'#E53E3E', medium:'#B8923A', low:'#3D6B4F' };
  document.getElementById('kanban').innerHTML = STATUSES.map(col => {
    const tasks = S.tasks.filter(t=>t.status===col.key);
    const nextStatus = col.key==='todo'?'in-progress':col.key==='in-progress'?'done':null;
    const prevStatus = col.key==='done'?'in-progress':col.key==='in-progress'?'todo':null;
    return `<div class="kanban-col">
      <div class="kanban-col-header">
        <div class="kanban-col-title">
          <div class="col-dot" style="background:${col.dot}"></div>
          ${col.label}
        </div>
        <div class="col-count">${tasks.length}</div>
      </div>
      ${tasks.map(t => `
        <div class="task-card">
          <div class="priority-dot" style="background:${prioColor[t.priority]}"></div>
          <div class="task-title ${t.status==='done'?'done-text':''}">${t.title}</div>
          <div class="task-tags">
            <span class="task-tag" style="background:${COLORS[TAG_COLORS[t.tag]||'sky'].bg};color:${COLORS[TAG_COLORS[t.tag]||'sky'].text}">${t.tag}</span>
            ${t.due?`<span class="task-tag" style="background:var(--surface2);color:var(--muted)">📅 ${t.due}</span>`:``}
          </div>
          <div class="task-bottom">
            <div></div>
            <div class="task-actions">
              ${prevStatus?`<button class="btn btn-ghost btn-xs" onclick="moveTask(${t.id},'${prevStatus}')">← Back</button>`:``}
              ${nextStatus?`<button class="btn btn-xs btn-colored" style="background:${col.dot};color:white" onclick="moveTask(${t.id},'${nextStatus}')">${col.key==='todo'?'Start →':'Done ✓'}</button>`:``}
              <button class="btn btn-ghost btn-xs del-btn" style="opacity:0" onclick="deleteTask(${t.id})">×</button>
            </div>
          </div>
        </div>
      `).join('') || `<div style="border:1.5px dashed var(--border);border-radius:var(--r-sm);padding:20px;text-align:center;color:var(--muted);font-size:11px;font-family:'JetBrains Mono',monospace">Empty</div>`}
    </div>`;
  }).join('');
}

// ═══════════════ HABITS ═══════════════

async function addHabit() {
  const emoji = document.getElementById('habit-emoji').value.trim() || '⭐';
  const name = document.getElementById('habit-name').value.trim();
  const color = document.getElementById('habit-color').value;
  if (!name) return toast('Enter a habit name', '⚠');
  
  await apiCall('/api/habits', 'POST', { emoji, name, color });
  closeModal('m-habit'); toast('Habit created! ⟳');
  ['habit-emoji','habit-name'].forEach(id=>document.getElementById(id).value='');
}

function toggleHabit(id, idx) {
  const h = S.habits.find(h=>h.id===id);
  if (!h) return;
  
  const weekDates = getWeekDates();
  const dateStr = weekDates[idx];
  
  const newLogs = { ...h.logs };
  if (!h.week[idx]) newLogs[dateStr] = true;
  else delete newLogs[dateStr];
  
  // Basic streak calc (all logs counted)
  const streak = Object.keys(newLogs).length;
  
  apiCall('/api/habits/'+id, 'PUT', { streak, logs: newLogs });
}

function toggleHabitToday(id) {
  toggleHabit(id, todayIdx());
}

function deleteHabit(id) { apiCall('/api/habits/'+id, 'DELETE').then(()=>toast('Habit removed','🗑')); }

function renderHabits() {
  document.getElementById('nb-habits').textContent = S.habits.length;
  const now = new Date();
  const monStart = new Date(now);
  monStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const sunEnd = new Date(monStart);
  sunEnd.setDate(monStart.getDate() + 6);
  const fmt2 = d => d.toLocaleDateString('en-IN', { day:'numeric', month:'short' });
  document.getElementById('habit-week-range').textContent = `${fmt2(monStart)} – ${fmt2(sunEnd)}`;

  const todayI = todayIdx();
  document.getElementById('habits-list').innerHTML = S.habits.map(h => {
    const c = COLORS[h.color];
    return `<div class="habit-row">
      <div class="habit-icon-wrap" style="background:${c.bg}">${h.emoji}</div>
      <div class="habit-info">
        <div class="habit-name">${h.name}</div>
        <div class="habit-streak">🔥 ${h.streak} total check-ins · ${h.week.filter(Boolean).length}/7 this week</div>
      </div>
      <div class="habit-week">
        ${WEEKDAYS.map((wd,i) => {
          const isScheduled = h.repeat_days ? h.repeat_days.includes(i) : true;
          if (!isScheduled) {
            return `<div class="h-dot" style="opacity:0.2; cursor:default; background:transparent; border-color:transparent" title="${wd} (Not Scheduled)">-</div>`;
          }
          return `
            <div class="h-dot ${h.week[i]?'checked':''} ${i===todayI?'today-dot':''}" onclick="toggleHabit(${h.id},${i})" title="${wd}">
              ${h.week[i]?'✓':wd.slice(0,1)}
            </div>
          `;
        }).join('')}
      </div>
      <button class="del-btn" onclick="deleteHabit(${h.id})">×</button>
    </div>`;
  }).join('') || emptyState('⟳','No habits yet. Add your first one!');

  const totalChecks = S.habits.reduce((a,h)=>a+h.week.filter(Boolean).length,0);
  const maxStreak = S.habits.length ? Math.max(...S.habits.map(h=>h.streak)) : 0;
  const todayDone = S.habits.filter(h=>h.week[todayI]).length;
  document.getElementById('habit-stats').innerHTML = `
    ${statCard('Today Done', `${todayDone}/${S.habits.length}`, 'delta-up', '✓ completed today', 'forest', '')}
    ${statCard('This Week', totalChecks + ' checks', 'delta-up', `↑ across ${S.habits.length} habits`, 'sky', '')}
    ${statCard('Best Habit', `🔥 ${maxStreak}`, 'delta-up', 'total checkins', 'gold', '')}
  `;
}

// ═══════════════ CALENDAR ═══════════════
async function addEvent() {
  const title = document.getElementById('event-title').value.trim();
  const date = document.getElementById('event-date').value;
  const time = document.getElementById('event-time').value;
  const color = document.getElementById('event-color').value;
  if (!title || !date) return toast('Fill in title and date', '⚠');
  
  await apiCall('/api/events', 'POST', { title, date, time, color });
  closeModal('m-event'); toast('Event added! ▦');
  ['event-title','event-time'].forEach(id=>document.getElementById(id).value='');
}

function deleteEvent(id) { apiCall('/api/events/'+id, 'DELETE').then(()=>toast('Event removed','🗑')); }

function calNav(dir) {
  S.calMonth += dir;
  if (S.calMonth > 11) { S.calMonth = 0; S.calYear++; }
  if (S.calMonth < 0) { S.calMonth = 11; S.calYear--; }
  saveLocal(); renderCalendar();
}

function calGoToday() {
  const now = new Date();
  S.calYear = now.getFullYear();
  S.calMonth = now.getMonth();
  S.selectedDate = fmtDate(now);
  saveLocal(); renderCalendar();
}

function selectDate(dateStr) {
  S.selectedDate = dateStr;
  saveLocal(); renderCalendar();
}

function renderCalendar() {
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const y = S.calYear, m = S.calMonth;
  document.getElementById('nb-events').textContent = S.events.length;
  document.getElementById('cal-month-title').textContent = `${MONTHS[m]} ${y}`;

  const firstDayOfMonth = new Date(y, m, 1).getDay();
  const offset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
  const daysInMonth = new Date(y, m+1, 0).getDate();
  const daysInPrev = new Date(y, m, 0).getDate();
  const todayStr = fmtDate(new Date());

  let cells = '';
  // Prev month padding
  for (let i = offset - 1; i >= 0; i--) {
    cells += `<div class="cal-day other-month"><div class="cal-day-num">${daysInPrev - i}</div></div>`;
  }
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const evs = S.events.filter(e=>e.date===ds);
    const isToday = ds === todayStr;
    const isSel = ds === S.selectedDate;
    cells += `<div class="cal-day ${isToday?'today':''} ${isSel&&!isToday?'selected':''}" onclick="selectDate('${ds}')">
      <div class="cal-day-num">${d}</div>
      <div class="cal-day-dots">${evs.slice(0,3).map(e=>`<div class="event-dot" style="background:${isToday?'rgba(255,255,255,0.6)':COLORS[e.color].fill}"></div>`).join('')}</div>
    </div>`;
  }
  // Next month padding
  const total = offset + daysInMonth;
  const remaining = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (let d = 1; d <= remaining; d++) {
    cells += `<div class="cal-day other-month"><div class="cal-day-num">${d}</div></div>`;
  }
  document.getElementById('cal-days').innerHTML = cells;

  // Event panel
  const selEvs = S.events.filter(e=>e.date===S.selectedDate).sort((a,b)=>a.time.localeCompare(b.time));
  const panelDate = S.selectedDate ? new Date(S.selectedDate+'T00:00:00').toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'}) : 'Select a day';
  document.getElementById('event-panel-title').textContent = panelDate;
  document.getElementById('event-panel-list').innerHTML = selEvs.map(e => `
    <div class="event-pill">
      <div class="event-color-bar" style="background:${COLORS[e.color].fill}"></div>
      <div style="flex:1">
        <div class="event-title-text">${e.title}</div>
        ${e.time?`<div class="event-time-text">${e.time}</div>`:'<div class="event-time-text">All day</div>'}
      </div>
      <button class="del-btn" onclick="deleteEvent(${e.id})">×</button>
    </div>
  `).join('') || `<div class="no-events">No events on this day</div>`;
}


// ═══════════════ DIET ═══════════════
const MEALS_ORDER = [
  { key:'breakfast', label:'Breakfast', icon:'🌅' },
  { key:'lunch',     label:'Lunch',     icon:'☀️' },
  { key:'dinner',    label:'Dinner',    icon:'🌙' },
  { key:'snacks',    label:'Snacks',    icon:'🍎' },
];

function dietNav(dir) {
  const d = new Date(S.dietDate + 'T00:00:00');
  d.setDate(d.getDate() + dir);
  S.dietDate = fmtDate(d);
  renderDiet();
}
function dietGoToday() { S.dietDate = fmtDate(new Date()); renderDiet(); }

async function addFood() {
  const name  = document.getElementById('food-name').value.trim();
  const cal   = parseFloat(document.getElementById('food-cal').value) || 0;
  const meal  = document.getElementById('food-meal').value;
  const date  = document.getElementById('food-date').value;
  const qty   = document.getElementById('food-qty').value.trim() || '1 serving';
  const protein = parseFloat(document.getElementById('food-protein').value) || 0;
  const carbs   = parseFloat(document.getElementById('food-carbs').value) || 0;
  const fat     = parseFloat(document.getElementById('food-fat').value) || 0;
  if (!name || !date) return toast('Enter food name and date', '⚠');
  try {
    const res = await fetch('/api/diet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meal_type: meal, name, qty, calories: cal, protein, carbs, fat, date })
    });
    if (!res.ok) throw new Error();
    await loadData();
    closeModal('m-food');
    ['food-name','food-qty','food-cal','food-protein','food-carbs','food-fat'].forEach(id => document.getElementById(id).value = '');
    toast('Food logged! 🥗');
  } catch { toast('Error saving meal', '⚠'); }
}

async function deleteFood(id) {
  if (!confirm('Delete this entry?')) return;
  try {
    await fetch('/api/diet/' + id, { method: 'DELETE' });
    await loadData();
    toast('Removed', '🗑');
  } catch { toast('Error deleting', '⚠'); }
}

async function toggleWater(idx) {
  const k = S.dietDate;
  let cups = S.water[k] || 0;
  cups = cups === idx + 1 ? idx : idx + 1;
  S.water[k] = cups;
  renderDiet();
  try {
    await fetch('/api/water', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: k, cups })
    });
  } catch { /* silent */ }
}

async function toggleWaterOverview(idx) {
  const k = fmtDate(new Date());
  let cups = S.water[k] || 0;
  cups = cups === idx + 1 ? idx : idx + 1;
  S.water[k] = cups;
  renderAll();
  try {
    await fetch('/api/water', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: k, cups })
    });
  } catch { /* silent */ }
}

async function saveCalGoal() {
  const v = parseInt(document.getElementById('cal-goal-input').value);
  if (v > 0) {
    S.calorieGoal = v;
    renderDiet();
    toast('Calorie goal updated!');
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'calorieGoal', value: v })
      });
    } catch { /* silent */ }
  }
}

function macroRing(label, consumed, goal, color, unit='g') {
  const pct  = goal > 0 ? Math.min(1, consumed / goal) : 0;
  const r    = 33, circ = 2 * Math.PI * r;
  const dash = pct * circ;
  return `<div class="macro-card">
    <div class="macro-ring-wrap">
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle class="macro-ring-bg" cx="40" cy="40" r="${r}" stroke="${color}22"/>
        <circle class="macro-ring-fill" cx="40" cy="40" r="${r}" stroke="${color}"
          stroke-dasharray="${dash.toFixed(1)} ${circ.toFixed(1)}" />
      </svg>
      <div class="macro-ring-text">
        <div class="macro-ring-val">${Math.round(consumed)}</div>
        <div class="macro-ring-unit">${unit}</div>
      </div>
    </div>
    <div class="macro-name">${label}</div>
    <div class="macro-sub">${Math.round(consumed)} / ${goal} ${unit}</div>
  </div>`;
}

function renderDiet() {
  const badge = document.getElementById('nb-diet');
  if (badge) badge.textContent = S.meals.filter(m => m.date === S.dietDate).length;

  // Date label
  const d = new Date(S.dietDate + 'T00:00:00');
  const todayStr = fmtDate(new Date());
  const isYesterday = S.dietDate === fmtDate(new Date(new Date() - 86400000));
  const dayLabel = S.dietDate === todayStr ? 'Today' : isYesterday ? 'Yesterday' : d.toLocaleDateString('en-IN',{weekday:'long', day:'numeric', month:'long'});
  const dateLabelEl = document.getElementById('diet-date-label');
  if (dateLabelEl) dateLabelEl.textContent = dayLabel;
  const calGoalInput = document.getElementById('cal-goal-input');
  if (calGoalInput) calGoalInput.placeholder = S.calorieGoal;

  const dayMeals = S.meals.filter(m => m.date === S.dietDate);
  const totCal  = dayMeals.reduce((a,m) => a + m.calories, 0);
  const totProt = dayMeals.reduce((a,m) => a + (m.protein||0), 0);
  const totCarb = dayMeals.reduce((a,m) => a + (m.carbs||0), 0);
  const totFat  = dayMeals.reduce((a,m) => a + (m.fat||0), 0);
  const goal    = S.calorieGoal;

  // Macro rings
  const macroEl = document.getElementById('macro-rings');
  if (macroEl) macroEl.innerHTML =
    macroRing('Calories', totCal,  goal, '#C96A3C', 'kcal') +
    macroRing('Protein',  totProt, 150,  '#3D6B4F') +
    macroRing('Carbs',    totCarb, 250,  '#B8923A') +
    macroRing('Fat',      totFat,  65,   '#B84A6A');

  // Meal sections
  const mealsEl = document.getElementById('diet-meals');
  if (mealsEl) mealsEl.innerHTML = MEALS_ORDER.map(m => {
    const items = dayMeals.filter(f => (f.meal_type || '').toLowerCase() === m.key.toLowerCase());
    const mCal  = items.reduce((a,f) => a + f.calories, 0);
    return `<div class="meal-section">
      <div class="meal-section-header" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'">
        <div class="meal-section-title">
          <span>${m.icon}</span>
          <span>${m.label}</span>
          <span style="font-size:11px;color:var(--muted);font-family:'JetBrains Mono',monospace;font-weight:400">${items.length} item${items.length!==1?'s':''}</span>
        </div>
        <div class="meal-section-meta">${mCal} kcal</div>
      </div>
      <div class="meal-items">
        ${items.map(f => `
          <div class="meal-item">
            <div class="meal-item-name">${f.name || 'Unknown Item'}</div>
            <div class="meal-item-qty">${f.qty||''}</div>
            <div class="meal-item-cal">${f.calories} kcal</div>
            <div class="meal-item-macros">P:${f.protein||0}g C:${f.carbs||0}g F:${f.fat||0}g</div>
            <button class="del-btn" style="opacity:1" onclick="deleteFood(${f.id})">×</button>
          </div>
        `).join('')}
        <button class="meal-add-btn" onclick="document.getElementById('food-meal').value='${m.key}';document.getElementById('food-date').value='${S.dietDate}';openModal('m-food')">
          + Add ${m.label} item
        </button>
      </div>
    </div>`;
  }).join('');

  // Water tracker
  const filled = S.water[S.dietDate] || 0;
  const waterLabelEl = document.getElementById('water-label');
  if (waterLabelEl) waterLabelEl.textContent = `${filled * 250}ml / 2000ml`;
  const waterTrackEl = document.getElementById('water-track');
  if (waterTrackEl) waterTrackEl.innerHTML = Array.from({length: 8}, (_,i) =>
    `<div class="water-cup ${i < filled ? 'filled' : ''}" onclick="toggleWater(${i})" title="${(i+1)*250}ml">💧</div>`
  ).join('');

  // Calorie goal display
  const remain  = goal - totCal;
  const pctGoal = Math.min(100, Math.round(totCal / goal * 100));
  const goalDisplayEl = document.getElementById('diet-goal-display');
  if (goalDisplayEl) goalDisplayEl.innerHTML = `
    <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted);font-family:'JetBrains Mono',monospace;margin-bottom:7px">
      <span>${totCal} eaten</span>
      <span style="color:${remain>=0?'var(--forest)':'#C53030'}">${remain>=0?remain+' left':Math.abs(remain)+' over'}</span>
    </div>
    <div class="budget-track">
      <div class="budget-fill" style="width:${pctGoal}%;background:${remain>=0?'var(--forest)':'#C53030'}"></div>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);font-family:'JetBrains Mono',monospace;margin-top:6px">
      <span>0</span><span>Goal: ${goal} kcal</span>
    </div>
  `;

  // 7-day history
  const history = [];
  for (let i = 6; i >= 0; i--) {
    const dh = new Date(); dh.setDate(dh.getDate() - i);
    const ds = fmtDate(dh);
    const c  = S.meals.filter(m => m.date === ds).reduce((a,m) => a + m.calories, 0);
    history.push({ ds, c, label: i===0?'Today':dh.toLocaleDateString('en-IN',{weekday:'short'}) });
  }
  const maxCal = Math.max(...history.map(h=>h.c), goal);
  const historyEl = document.getElementById('diet-history');
  if (historyEl) historyEl.innerHTML = history.map(h => `
    <div class="diet-log-row">
      <div class="diet-log-date">${h.label}</div>
      <div class="diet-log-cals">${h.c}</div>
      <div class="diet-log-bar"><div class="diet-log-fill" style="width:${h.c>0?Math.round(h.c/maxCal*100):0}%;background:${h.c>goal?'#C53030':'var(--terracotta)'}"></div></div>
    </div>
  `).join('');
}

// ═══════════════ RENDER ALL ═══════════════
function renderAll() {
  renderSidebarDate();
  renderOverview();
  renderFinance();
  renderGoals();
  renderTasks();
  renderHabits();
  renderDiet();
  renderCalendar();
}

// Initialize
loadData();

setInterval(() => {
  document.querySelector('.sidebar-footer').style.color = 'rgba(255,255,255,0.3)';
  document.querySelector('.sidebar-footer').textContent = 'v3.0 (Cloud) · live';
}, 30000);

