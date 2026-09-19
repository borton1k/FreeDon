const express=require('express');const cors=require('cors');const bcrypt=require('bcryptjs');const fs=require('fs');const path=require('path');
const app=express();const PORT=process.env.PORT||3000;const DB_FILE=path.join(__dirname,'db.json');
const ADMINS=["akaidzu"];
const AVATARS=["🦊","🐺","🐯","🦁","🐸","🐲","🐉","🦅","🦉","🐙"];
const ITEMS=[
{id:1,name:"Тотем Бессмертия",price:3,color:"#9ca3af"},
{id:2,name:"Сет Алмазной Брони З4",price:4,color:"#9ca3af"},
{id:3,name:"Зелье Черепашей Мощи",price:5,color:"#9ca3af"},
{id:4,name:"Зачарованное Золотое Яблоко",price:8,color:"#22c55e"},
{id:5,name:"Шар Порядка",price:10,color:"#22c55e"},
{id:6,name:"Алый Лотос",price:12,color:"#22c55e"},
{id:7,name:"Шар Дыни (на урон)",price:15,color:"#3b82f6"},
{id:8,name:"Зимнее Зелье",price:20,color:"#3b82f6"},
{id:9,name:"Слово Дыни, Сок На Асфальте",price:25,color:"#a855f7"},
{id:10,name:"Ломтик Дыни",price:35,color:"#a855f7"},
{id:11,name:"Талисман Sponsor",price:50,color:"#ef4444"}
];
const CASES={
hach:{id:"hach",name:"Хач",price:4,emoji:"🥉",min:3,max:5,weights:[50,30,20]},
harosh:{id:"harosh",name:"Харош",price:10,emoji:"🥈",min:8,max:12,weights:[50,30,20]},
legenda:{id:"legenda",name:"Легенда",price:20,emoji:"🥇",min:15,max:25,weights:[65,35]},
sigma:{id:"sigma",name:"Сигма",price:40,emoji:"💎",min:35,max:50,weights:[70,30]}
};
function loadDB(){try{const raw=fs.readFileSync(DB_FILE,'utf8');const d=JSON.parse(raw);if(!d.users)d.users={};if(!d.promocodes)d.promocodes={};return d;}catch(e){return{users:{},promocodes:{}};}}
function saveDB(db){fs.writeFileSync(DB_FILE,JSON.stringify(db,null,2),'utf8');}
function genTicket(){let id='';for(let i=0;i<8;i++)id+=Math.floor(Math.random()*10);return id;}
function genPromo(){let c='FD';for(let i=0;i<6;i++)c+=Math.floor(Math.random()*10);return c;}
app.use(cors());app.use(express.json({limit:'1mb'}));
app.get('/',(req,res)=>{res.sendFile(path.join(__dirname,'index.html'));});

app.post('/api/register',async(req,res)=>{
try{
const{username,password}=req.body;
if(!username||!password)return res.status(400).json({error:'Логин и пароль обязательны'});
if(!/^[a-zA-Z0-9_]{3,16}$/.test(username))return res.status(400).json({error:'Ник: 3–16 символов, латиница, цифры, _'});
if(password.length<4)return res.status(400).json({error:'Пароль минимум 4 символа'});
const db=loadDB();
if(db.users[username])return res.status(400).json({error:'Такой ник уже занят'});
const hash=await bcrypt.hash(password,10);
db.users[username]={hash,balance:0,inventory:[],history:[],notifications:[],lastDailyBonus:0,usedPromocodes:[],luckMode:"random",avatar:"🦊",createdAt:Date.now()};
saveDB(db);res.json({ok:true});
}catch(e){console.error(e);res.status(500).json({error:'Ошибка сервера'});}
});

app.post('/api/login',async(req,res)=>{
try{
const{username,password}=req.body;
if(!username||!password)return res.status(400).json({error:'Логин и пароль обязательны'});
const db=loadDB();const user=db.users[username];
if(!user)return res.status(400).json({error:'Игрок не найден'});
const ok=await bcrypt.compare(password,user.hash);
if(!ok)return res.status(400).json({error:'Неверный пароль'});
res.json({ok:true,user:{username,balance:user.balance,inventory:user.inventory,history:user.history,notifications:user.notifications||[],lastDailyBonus:user.lastDailyBonus||0,avatar:user.avatar||"🦊",createdAt:user.createdAt}});
}catch(e){res.status(500).json({error:'Ошибка сервера'});}
});

app.post('/api/user',(req,res)=>{
try{
const{username,password}=req.body;
const db=loadDB();const user=db.users[username];
if(!user)return res.status(404).json({error:'Игрок не найден'});
bcrypt.compare(password||'',user.hash).then(ok=>{
if(!ok)return res.status(403).json({error:'Неверный пароль'});
res.json({balance:user.balance,inventory:user.inventory,history:user.history,notifications:user.notifications||[],lastDailyBonus:user.lastDailyBonus||0,avatar:user.avatar||"🦊",createdAt:user.createdAt});
});
}catch(e){res.status(500).json({error:'Ошибка'});}
});

app.post('/api/notifications/consume',(req,res)=>{
try{
const{username,password}=req.body;
const db=loadDB();const user=db.users[username];
if(!user)return res.status(404).json({error:'Не найден'});
bcrypt.compare(password||'',user.hash).then(ok=>{
if(!ok)return res.status(403).json({error:'Неверный пароль'});
const notes=user.notifications||[];
user.notifications=[];
saveDB(db);
res.json({notifications:notes});
});
}catch(e){res.status(500).json({error:'Ошибка'});}
});

app.post('/api/avatar/set',(req,res)=>{
try{
const{username,password,avatar}=req.body;
if(!username||!password||!avatar)return res.status(400).json({error:'Нет данных'});
if(!AVATARS.includes(avatar))return res.status(400).json({error:'Недопустимая аватарка'});
const db=loadDB();const user=db.users[username];
if(!user)return res.status(404).json({error:'Не найден'});
bcrypt.compare(password,user.hash).then(ok=>{
if(!ok)return res.status(403).json({error:'Неверный пароль'});
user.avatar=avatar;
saveDB(db);
res.json({ok:true,avatar});
});
}catch(e){res.status(500).json({error:'Ошибка'});}
});

app.post('/api/leaderboard',(req,res)=>{
try{
const db=loadDB();
const list=Object.keys(db.users).map(u=>{
const usr=db.users[u];
const inv=usr.inventory||[];
const invValue=inv.reduce((s,i)=>s+(i.price||0),0);
const history=usr.history||[];
const wins=history.filter(h=>h.win).length;
const score=(usr.balance||0)+invValue+wins*10;
return{username:u,avatar:usr.avatar||"🦊",balance:usr.balance||0,inventoryValue:invValue,wins,score,inventoryCount:inv.length};
});
list.sort((a,b)=>b.score-a.score);
res.json({leaderboard:list.slice(0,20)});
}catch(e){res.status(500).json({error:'Ошибка'});}
});

app.post('/api/cases/list',(req,res)=>{
const list=Object.values(CASES).map(c=>({id:c.id,name:c.name,price:c.price,emoji:c.emoji,min:c.min,max:c.max}));
res.json({cases:list});
});

app.post('/api/cases/open',(req,res)=>{
try{
const{username,password,caseId}=req.body;
if(!username||!password||!caseId)return res.status(400).json({error:'Нет данных'});
const c=CASES[caseId];
if(!c)return res.status(400).json({error:'Кейс не найден'});
const db=loadDB();const user=db.users[username];
if(!user)return res.status(404).json({error:'Не найден'});
bcrypt.compare(password,user.hash).then(ok=>{
if(!ok)return res.status(403).json({error:'Неверный пароль'});
if(user.balance<c.price)return res.status(400).json({error:'Недостаточно монет'});
const available=ITEMS.filter(i=>i.price>=c.min&&i.price<=c.max).sort((a,b)=>a.price-b.price);
if(available.length===0)return res.status(400).json({error:'Нет предметов для этого кейса'});
const weights=c.weights.slice(0,available.length);
const totalW=weights.reduce((s,w)=>s+w,0);
let roll=Math.random()*totalW;
let picked=available[available.length-1];
for(let i=0;i<available.length;i++){
roll-=weights[i];
if(roll<=0){picked=available[i];break;}
}
user.balance-=c.price;
const newItem={...picked,legit:true,source:'case',obtainedAt:Date.now(),ticketId:genTicket()};
user.inventory.push(newItem);
if(!user.notifications)user.notifications=[];
user.notifications.push(`Кейс "${c.name}": ${picked.name}!`);
saveDB(db);
res.json({ok:true,item:newItem,balance:user.balance,inventory:user.inventory});
});
}catch(e){console.error(e);res.status(500).json({error:'Ошибка сервера'});}
});

app.post('/api/upgrade',(req,res)=>{
try{
const{username,password,fromItemId,toItemId}=req.body;
if(!username||!password)return res.status(400).json({error:'Не авторизован'});
const db=loadDB();const user=db.users[username];
if(!user)return res.status(404).json({error:'Не найден'});
bcrypt.compare(password,user.hash).then(ok=>{
if(!ok)return res.status(403).json({error:'Неверный пароль'});
const fromItem=ITEMS.find(i=>i.id===fromItemId);
const toItem=ITEMS.find(i=>i.id===toItemId);
if(!fromItem||!toItem)return res.status(400).json({error:'Предмет не найден'});
const idx=user.inventory.findIndex(i=>i.id===fromItemId);
if(idx===-1)return res.status(400).json({error:'У вас нет этого предмета в инвентаре'});
let chance=(fromItem.price/toItem.price)*100;
if(chance>90)chance=90;
let isWin;
if(user.luckMode==="win")isWin=true;
else if(user.luckMode==="lose")isWin=false;
else isWin=Math.random()*100<=chance;
user.inventory.splice(idx,1);
if(isWin){user.inventory.push({...toItem,legit:true,source:'upgrade',obtainedAt:Date.now(),ticketId:genTicket()});}
user.history.unshift({id:Date.now(),from:fromItem.name,to:toItem.name,chance:parseFloat(chance.toFixed(2)),win:isWin,time:new Date().toLocaleTimeString().slice(0,5)});
if(user.history.length>50)user.history=user.history.slice(0,50);
saveDB(db);
res.json({ok:true,win:isWin,chance:parseFloat(chance.toFixed(2)),balance:user.balance,inventory:user.inventory,history:user.history});
});
}catch(e){console.error(e);res.status(500).json({error:'Ошибка сервера'});}
});

app.post('/api/buy',(req,res)=>{
try{
const{username,password,item}=req.body;
if(!username||!password||!item)return res.status(400).json({error:'Нет данных'});
const db=loadDB();const user=db.users[username];
if(!user)return res.status(404).json({error:'Не найден'});
bcrypt.compare(password,user.hash).then(ok=>{
if(!ok)return res.status(403).json({error:'Неверный пароль'});
if(user.balance<item.price)return res.status(400).json({error:'Недостаточно монет'});
user.balance-=item.price;
user.inventory.push({...item,legit:true,source:'shop',obtainedAt:Date.now(),ticketId:genTicket()});
saveDB(db);
res.json({ok:true,balance:user.balance,inventory:user.inventory});
});
}catch(e){res.status(500).json({error:'Ошибка'});}
});

app.post('/api/promo/create',(req,res)=>{
try{
const{adminUser,adminPass,type,amount,itemId,itemCount,limit}=req.body;
if(!ADMINS.includes(adminUser))return res.status(403).json({error:'Нет прав'});
const db=loadDB();const admin=db.users[adminUser];
if(!admin)return res.status(404).json({error:'Админ не найден'});
bcrypt.compare(adminPass,admin.hash).then(ok=>{
if(!ok)return res.status(403).json({error:'Неверный пароль'});
if(type!=='money'&&type!=='item')return res.status(400).json({error:'Неверный тип'});
let code=genPromo();
while(db.promocodes[code])code=genPromo();
const lim=Math.max(1,Math.min(1000,parseInt(limit)||1));
const promo={code,type,limit:lim,used:0,createdAt:Date.now(),expiresAt:Date.now()+14*24*60*60*1000,activations:{}};
if(type==='money'){
const amt=Math.max(1,Math.min(10000,parseInt(amount)||1));
promo.amount=amt;
}else{
const cnt=Math.max(1,Math.min(10,parseInt(itemCount)||1));
promo.itemId=parseInt(itemId);
promo.itemCount=cnt;
}
db.promocodes[code]=promo;
saveDB(db);
res.json({ok:true,code,promo});
});
}catch(e){console.error(e);res.status(500).json({error:'Ошибка сервера'});}
});

app.post('/api/promo/activate',(req,res)=>{
try{
const{username,password,code}=req.body;
if(!username||!password||!code)return res.status(400).json({error:'Нет данных'});
const db=loadDB();const user=db.users[username];
if(!user)return res.status(404).json({error:'Не найден'});
bcrypt.compare(password,user.hash).then(ok=>{
if(!ok)return res.status(403).json({error:'Неверный пароль'});
const cleanCode=(code||'').trim().toUpperCase();
const promo=db.promocodes[cleanCode];
if(!promo)return res.status(400).json({error:'Такого промокода не существует'});
if(promo.expiresAt<Date.now())return res.status(400).json({error:'Промокод истёк'});
if(promo.used>=promo.limit)return res.status(400).json({error:'Лимит активаций исчерпан'});
if(!Array.isArray(user.usedPromocodes))user.usedPromocodes=[];
if(user.usedPromocodes.includes(cleanCode))return res.status(400).json({error:'Вы уже активировали этот промокод'});
if(!promo.activations)promo.activations={};
promo.activations[username]=Date.now();
promo.used+=1;
user.usedPromocodes.push(cleanCode);
let rewardText='';
if(promo.type==='money'){
user.balance+=promo.amount;
rewardText=`+${promo.amount} монет`;
user.notifications.push(`Промокод ${cleanCode} активирован: +${promo.amount} монет`);
}else{
const it=ITEMS.find(x=>x.id===promo.itemId);
if(!it)return res.status(400).json({error:'Предмет промокода не найден'});
for(let i=0;i<promo.itemCount;i++){
user.inventory.push({...it,legit:true,source:'promo',obtainedAt:Date.now(),ticketId:genTicket()});
}
rewardText=`${it.name} × ${promo.itemCount}`;
user.notifications.push(`Промокод ${cleanCode} активирован: ${it.name} × ${promo.itemCount}`);
}
saveDB(db);
res.json({ok:true,rewardText,balance:user.balance,inventory:user.inventory});
});
}catch(e){console.error(e);res.status(500).json({error:'Ошибка сервера'});}
});

app.post('/api/promo/list',(req,res)=>{
try{
const{adminUser,adminPass}=req.body;
if(!ADMINS.includes(adminUser))return res.status(403).json({error:'Нет прав'});
const db=loadDB();const admin=db.users[adminUser];
if(!admin)return res.status(404).json({error:'Админ не найден'});
bcrypt.compare(adminPass,admin.hash).then(ok=>{
if(!ok)return res.status(403).json({error:'Неверный пароль'});
const list=Object.values(db.promocodes).map(p=>{
let itemName=null;
if(p.type==='item'){
const it=ITEMS.find(x=>x.id===p.itemId);
itemName=it?it.name:'?';
}
return{code:p.code,type:p.type,amount:p.amount||null,itemName,itemCount:p.itemCount||null,used:p.used,limit:p.limit,expiresAt:p.expiresAt,createdAt:p.createdAt};
});
res.json({promocodes:list});
});
}catch(e){res.status(500).json({error:'Ошибка'});}
});

app.post('/api/promo/delete',(req,res)=>{
try{
const{adminUser,adminPass,code}=req.body;
if(!ADMINS.includes(adminUser))return res.status(403).json({error:'Нет прав'});
const db=loadDB();const admin=db.users[adminUser];
if(!admin)return res.status(404).json({error:'Админ не найден'});
bcrypt.compare(adminPass,admin.hash).then(ok=>{
if(!ok)return res.status(403).json({error:'Неверный пароль'});
if(!db.promocodes[code])return res.status(404).json({error:'Промокод не найден'});
delete db.promocodes[code];
saveDB(db);
res.json({ok:true});
});
}catch(e){res.status(500).json({error:'Ошибка'});}
});

app.post('/api/admin/grant',(req,res)=>{
try{
const{adminUser,adminPass,targetUser,amount}=req.body;
if(!ADMINS.includes(adminUser))return res.status(403).json({error:'Нет прав'});
const db=loadDB();const admin=db.users[adminUser];
if(!admin)return res.status(404).json({error:'Админ не найден'});
bcrypt.compare(adminPass,admin.hash).then(ok=>{
if(!ok)return res.status(403).json({error:'Неверный пароль админа'});
const target=db.users[targetUser];
if(!target)return res.status(404).json({error:`Игрок "${targetUser}" не найден`});
const sum=Number(amount);
if(!sum||isNaN(sum))return res.status(400).json({error:'Неверная сумма'});
if(target.balance+sum<0)return res.status(400).json({error:'Баланс не может быть отрицательным'});
target.balance+=sum;
if(sum>0){
if(!target.notifications)target.notifications=[];
target.notifications.push(`Администратор выдал вам ${sum} монет!`);
}
saveDB(db);
res.json({ok:true,text:`${targetUser}: ${sum>0?'начислено':'списано'} ${Math.abs(sum)} монет`});
});
}catch(e){res.status(500).json({error:'Ошибка'});}
});

app.post('/api/admin/luck',(req,res)=>{
try{
const{adminUser,adminPass,targetUser,mode}=req.body;
if(!ADMINS.includes(adminUser))return res.status(403).json({error:'Нет прав'});
if(!['random','win','lose'].includes(mode))return res.status(400).json({error:'Неверный режим'});
const db=loadDB();const admin=db.users[adminUser];
if(!admin)return res.status(404).json({error:'Админ не найден'});
bcrypt.compare(adminPass,admin.hash).then(ok=>{
if(!ok)return res.status(403).json({error:'Неверный пароль'});
const target=db.users[targetUser];
if(!target)return res.status(404).json({error:'Игрок не найден'});
target.luckMode=mode;
saveDB(db);
const labels={random:'случайно',win:'всегда победа',lose:'всегда проигрыш'};
res.json({ok:true,text:`${targetUser}: режим "${labels[mode]}"`});
});
}catch(e){res.status(500).json({error:'Ошибка'});}
});

app.post('/api/admin/list',(req,res)=>{
try{
const{adminUser,adminPass}=req.body;
if(!ADMINS.includes(adminUser))return res.status(403).json({error:'Нет прав'});
const db=loadDB();const admin=db.users[adminUser];
if(!admin)return res.status(404).json({error:'Админ не найден'});
bcrypt.compare(adminPass,admin.hash).then(ok=>{
if(!ok)return res.status(403).json({error:'Неверный пароль'});
const list=Object.keys(db.users).map(u=>({
username:u,
balance:db.users[u].balance||0,
inventoryCount:(db.users[u].inventory||[]).length,
luckMode:db.users[u].luckMode||'random',
avatar:db.users[u].avatar||'🦊'
}));
res.json({users:list});
});
}catch(e){res.status(500).json({error:'Ошибка'});}
});

app.listen(PORT,()=>{console.log(`FreeDon Upgrader сервер запущен на порту ${PORT}`);});
