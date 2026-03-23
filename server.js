require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- TRANSACTIONS ---
app.get('/api/transactions', async (req, res) => {
  const { data, error } = await supabase.from('transactions').select('*').order('date', {ascending: false}).order('id', {ascending: false});
  if (error) res.status(500).json({ error: error.message });
  else res.json(data);
});

app.post('/api/transactions', async (req, res) => {
  const { desc, amount, type, cat, date } = req.body;
  const { data, error } = await supabase.from('transactions').insert([{ "desc": desc, amount, type, cat, date }]).select();
  if (error) res.status(500).json({ error: error.message });
  else res.json(data[0]);
});

app.delete('/api/transactions/:id', async (req, res) => {
  const { error } = await supabase.from('transactions').delete().eq('id', req.params.id);
  if (error) res.status(500).json({ error: error.message });
  else res.json({ deleted: true });
});

// --- GOALS ---
app.get('/api/goals', async (req, res) => {
  const { data, error } = await supabase.from('goals').select('*').order('id', {ascending: true});
  if (error) res.status(500).json({ error: error.message });
  else res.json(data);
});

app.post('/api/goals', async (req, res) => {
  const { emoji, name, target, deadline, color } = req.body;
  const { data, error } = await supabase.from('goals').insert([{ emoji, name, target, deadline, color, current: 0 }]).select();
  if (error) res.status(500).json({ error: error.message });
  else res.json(data[0]);
});

app.put('/api/goals/:id', async (req, res) => {
  const { current } = req.body;
  const { error } = await supabase.from('goals').update({ current }).eq('id', req.params.id);
  if (error) res.status(500).json({ error: error.message });
  else res.json({ updated: true });
});

// --- TASKS ---
app.get('/api/tasks', async (req, res) => {
  const { data, error } = await supabase.from('tasks').select('*').order('id', {ascending: true});
  if (error) res.status(500).json({ error: error.message });
  else res.json(data);
});

app.post('/api/tasks', async (req, res) => {
  const { title, priority, tag, due } = req.body;
  const { data, error } = await supabase.from('tasks').insert([{ title, priority, tag, due, status: 'todo' }]).select();
  if (error) res.status(500).json({ error: error.message });
  else res.json(data[0]);
});

app.put('/api/tasks/:id', async (req, res) => {
  const { status, title } = req.body;
  const updates = {};
  if (status !== undefined) updates.status = status;
  if (title !== undefined) updates.title = title;
  const { error } = await supabase.from('tasks').update(updates).eq('id', req.params.id);
  if (error) res.status(500).json({ error: error.message });
  else res.json({ updated: true });
});

app.delete('/api/tasks/:id', async (req, res) => {
  const { error } = await supabase.from('tasks').delete().eq('id', req.params.id);
  if (error) res.status(500).json({ error: error.message });
  else res.json({ deleted: true });
});

// --- HABITS ---
app.get('/api/habits', async (req, res) => {
  const { data, error } = await supabase.from('habits').select('*').order('id', {ascending: true});
  if (error) {
    res.status(500).json({ error: error.message });
  } else {
    const mapped = data.map(r => ({ ...r, logs: JSON.parse(r.logs), repeat_days: JSON.parse(r.repeat_days || '[0,1,2,3,4,5,6]') }));
    res.json(mapped);
  }
});

app.post('/api/habits', async (req, res) => {
  const { emoji, name, color, repeat_days } = req.body;
  const daysStr = repeat_days ? JSON.stringify(repeat_days) : '[0,1,2,3,4,5,6]';
  const { data, error } = await supabase.from('habits').insert([{ emoji, name, color, streak: 0, logs: '{}', repeat_days: daysStr }]).select();
  if (error) res.status(500).json({ error: error.message });
  else {
    res.json({ ...data[0], logs: JSON.parse(data[0].logs), repeat_days: JSON.parse(data[0].repeat_days) });
  }
});

app.put('/api/habits/:id', async (req, res) => {
  const { streak, logs, repeat_days } = req.body;
  const updates = { streak, logs: JSON.stringify(logs) };
  if (repeat_days !== undefined) updates.repeat_days = JSON.stringify(repeat_days);
  const { error } = await supabase.from('habits').update(updates).eq('id', req.params.id);
  if (error) res.status(500).json({ error: error.message });
  else res.json({ updated: true });
});

app.delete('/api/habits/:id', async (req, res) => {
  const { error } = await supabase.from('habits').delete().eq('id', req.params.id);
  if (error) res.status(500).json({ error: error.message });
  else res.json({ deleted: true });
});

// --- EVENTS ---
app.get('/api/events', async (req, res) => {
  const { data, error } = await supabase.from('events').select('*').order('date', {ascending: true});
  if (error) res.status(500).json({ error: error.message });
  else res.json(data);
});

app.post('/api/events', async (req, res) => {
  const { title, date, time, color } = req.body;
  const { data, error } = await supabase.from('events').insert([{ title, date, time, color }]).select();
  if (error) res.status(500).json({ error: error.message });
  else res.json(data[0]);
});

// --- DIET ---
app.get('/api/diet', async (req, res) => {
  const { data, error } = await supabase.from('diet').select('*').order('date', {ascending: true}).order('id', {ascending: true});
  if (error) res.status(500).json({ error: error.message });
  else res.json(data);
});

app.post('/api/diet', async (req, res) => {
  const { meal_type, name, qty, calories, protein, carbs, fat, date } = req.body;
  const { data, error } = await supabase.from('diet').insert([{ meal_type, name, qty, calories, protein: protein||0, carbs: carbs||0, fat: fat||0, date }]).select();
  if (error) res.status(500).json({ error: error.message });
  else res.json(data[0]);
});

app.delete('/api/diet/:id', async (req, res) => {
  const { error } = await supabase.from('diet').delete().eq('id', req.params.id);
  if (error) res.status(500).json({ error: error.message });
  else res.json({ deleted: true });
});

// --- WATER ---
app.get('/api/water', async (req, res) => {
  const { data, error } = await supabase.from('water_logs').select('*');
  if (error) res.status(500).json({ error: error.message });
  else {
    const map = {};
    data.forEach(r => { map[r.date] = r.cups; });
    res.json(map);
  }
});

app.post('/api/water', async (req, res) => {
  const { date, cups } = req.body;
  const { data, error } = await supabase.from('water_logs').upsert({ date, cups }, { onConflict: 'date' });
  if (error) res.status(500).json({ error: error.message });
  else res.json({ updated: true });
});

// --- SETTINGS ---
app.get('/api/settings', async (req, res) => {
  const { data, error } = await supabase.from('settings').select('*');
  if (error) res.status(500).json({ error: error.message });
  else {
    const map = {};
    data.forEach(r => { map[r.key] = r.value; });
    res.json(map);
  }
});

app.post('/api/settings', async (req, res) => {
  const { key, value } = req.body;
  const { data, error } = await supabase.from('settings').upsert({ key, value }, { onConflict: 'key' });
  if (error) res.status(500).json({ error: error.message });
  else res.json({ updated: true });
});

// Export for Vercel Serverless
if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => console.log(`LifeOS Dashboard running at http://localhost:${port}`));
}
module.exports = app;
