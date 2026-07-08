function playSound(id,vol){
    // Compatibility wrapper. New code should call AudioManager.play(category).
    const map = {
        roomAmbience: "ambience",
        drawDeckSound: "drawDeck",
        drawDiscardSound: "drawDiscard",
        discardSound: "discard",
        burnSound: "burn",
        tradeSound: "trade",
        cardFlipSound: "flip",
        shuffleSound: "shuffle",
        shuffleDeckSound: "shuffle",
        placeCardSound: "place",
        actionCardSound: "action"
    };

    const category = map[id] || id;

    if(window.AudioManager){
        return AudioManager.play(category, { volume: vol });
    }
}

function startRoomAmbience(){
    if(window.AudioManager){
        AudioManager.startAmbience();
    }
}

let ambienceEnabled=true;
let sfxEnabled=true;

function escapeHtml(value){
    if(window.ActionHoldemUtils && window.ActionHoldemUtils.escapeHtml){
        return window.ActionHoldemUtils.escapeHtml(value);
    }
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[char]));
}

function toggleAmbience(){
    ambienceEnabled = !ambienceEnabled;

    if(window.AudioManager){
        AudioManager.setAmbienceEnabled(ambienceEnabled);
    }

    const btn=document.getElementById('ambienceToggleBtn');
    if(btn){
        btn.textContent = ambienceEnabled ? '🔊 Ambience: ON' : '🔇 Ambience: OFF';
    }
}

function toggleSFX(){
    sfxEnabled=!sfxEnabled;

    if(window.AudioManager){
        AudioManager.setSfxEnabled(sfxEnabled);
    }

    const btn=document.getElementById('sfxToggleBtn');
    if(btn){
        btn.textContent=sfxEnabled ? '🔊 SFX: ON' : '🔇 SFX: OFF';
    }
}

let deck=[];
let players=[];
let currentPlayerIndex=0;
let dealerIndex=-1;
let gameScores=[0,0,0,0];
let handAlreadyScored=false;
let handOver=false;

let discardPile=[];
let burnPile=[];
let flop=[];
let turnCard=null;
let riverCard=null;
let phase="PRE-FLOP";
let turnState="MUST_DRAW";
let nextCardId=1;
let lastDrawnFromDiscardId=null;
let turnsTakenThisRound=0;
let handRevealed=false;
let playerNames=['Player 1','Player 2','Player 3','Player 4','Player 5','Player 6','Player 7','Player 8','Player 9','Player 10'];
let playerCount=4;
let humanPlayerCount=1;
let aiPlayerCount=3;
let aiNames=['RiverRat','ChipBot','All-In Al','PocketBot','The Grinder','Bad Beat Bob'];
let aiDifficulty="normal";

const AI_DIFFICULTY_SETTINGS={
    easy:{
        label:"Easy",
        actionChance:.35,
        smartTargeting:.35,
        discardSkill:.35,
        drawDiscardBonus:.15,
        thinkingMs:650
    },
    normal:{
        label:"Normal",
        actionChance:.60,
        smartTargeting:.65,
        discardSkill:.60,
        drawDiscardBonus:.25,
        thinkingMs:750
    },
    hard:{
        label:"Hard",
        actionChance:.78,
        smartTargeting:.85,
        discardSkill:.82,
        drawDiscardBonus:.38,
        thinkingMs:850
    },
    expert:{
        label:"Expert",
        actionChance:.90,
        smartTargeting:.98,
        discardSkill:.95,
        drawDiscardBonus:.48,
        thinkingMs:950
    }
};

const AI_IDENTITIES=[
    {
        id:"riverRat",
        name:"RiverRat",
        avatar:"🦈",
        color:"#0ea5e9",
        personality:"Aggressive",
        description:"Attacks leaders and loves Burn cards.",
        preferredActions:["burn_targeted","burn_all","skip","trade_hands","bonus_self","bonus_targeted","face_up_targeted","peek_targeted"],
        drawDiscardBias:.42,
        targetStrategy:"leader"
    },
    {
        id:"chipBot",
        name:"ChipBot",
        avatar:"🤖",
        color:"#64748b",
        personality:"Calculator",
        description:"Conservative, efficient, and avoids wasted action cards.",
        preferredActions:["bonus_self","bonus_targeted","peek_targeted","skip","burn_targeted","face_up_targeted","trade_hands"],
        drawDiscardBias:.25,
        targetStrategy:"leader"
    },
    {
        id:"allInAl",
        name:"All-In Al",
        avatar:"🎩",
        color:"#111827",
        personality:"High Roller",
        description:"Aggressive and action-heavy.",
        preferredActions:["bonus_self","trade_hands","skip","burn_targeted","bonus_targeted","burn_all","pass_left","pass_right"],
        drawDiscardBias:.50,
        targetStrategy:"leader"
    },
    {
        id:"pocketBot",
        name:"PocketBot",
        avatar:"🃏",
        color:"#7c3aed",
        personality:"Hand Builder",
        description:"Focuses on improving hand quality.",
        preferredActions:["bonus_self","peek_targeted","change_community","bonus_targeted","skip","face_up_targeted","burn_targeted"],
        drawDiscardBias:.36,
        targetStrategy:"threat"
    },
    {
        id:"grinder",
        name:"The Grinder",
        avatar:"🛡️",
        color:"#92400e",
        personality:"Patient",
        description:"Slow, defensive, and steady.",
        preferredActions:["bonus_self","full_reset_self","skip","peek_targeted","bonus_targeted","burn_targeted"],
        drawDiscardBias:.18,
        targetStrategy:"leader"
    },
    {
        id:"badBeatBob",
        name:"Bad Beat Bob",
        avatar:"💀",
        color:"#b91c1c",
        personality:"Saboteur",
        description:"Targets whoever is winning and creates chaos.",
        preferredActions:["burn_targeted","skip","face_up_targeted","burn_all","trade_hands","pass_left","pass_right","peek_targeted"],
        drawDiscardBias:.45,
        targetStrategy:"leader"
    },
    {
        id:"viper",
        name:"Viper",
        avatar:"🐍",
        color:"#15803d",
        personality:"Sneaky",
        description:"Likes Peek, Face Up, and tactical disruption.",
        preferredActions:["peek_targeted","face_up_targeted","skip","burn_targeted","trade_hands","bonus_self","bonus_targeted"],
        drawDiscardBias:.34,
        targetStrategy:"threat"
    },
    {
        id:"lucky",
        name:"Lucky",
        avatar:"🎲",
        color:"#f97316",
        personality:"Chaotic",
        description:"Random and unpredictable.",
        preferredActions:["pass_left","pass_right","trade_hands","bonus_self","burn_all","skip","burn_targeted","peek_targeted"],
        drawDiscardBias:.55,
        targetStrategy:"random"
    },
    {
        id:"owl",
        name:"Owl",
        avatar:"🦉",
        color:"#6d28d9",
        personality:"Observer",
        description:"Peeks often and picks careful spots.",
        preferredActions:["peek_targeted","bonus_self","change_community","skip","face_up_targeted","bonus_targeted","burn_targeted"],
        drawDiscardBias:.28,
        targetStrategy:"threat"
    },
    {
        id:"wolf",
        name:"Wolf",
        avatar:"🐺",
        color:"#334155",
        personality:"Balanced",
        description:"Balanced mix of offense and defense.",
        preferredActions:["bonus_self","skip","burn_targeted","peek_targeted","trade_hands","bonus_targeted","face_up_targeted"],
        drawDiscardBias:.35,
        targetStrategy:"leader"
    },
    {
        id:"queen",
        name:"Queen",
        avatar:"👑",
        color:"#be185d",
        personality:"Defensive",
        description:"Protects her own hand and avoids unnecessary risk.",
        preferredActions:["bonus_self","full_reset_self","peek_targeted","skip","bonus_targeted","face_up_targeted","burn_targeted"],
        drawDiscardBias:.22,
        targetStrategy:"leader"
    },
    {
        id:"falcon",
        name:"Falcon",
        avatar:"🦅",
        color:"#1d4ed8",
        personality:"Fast Attack",
        description:"Acts quickly and pressures the leader.",
        preferredActions:["skip","burn_targeted","bonus_self","face_up_targeted","trade_hands","bonus_targeted","burn_all"],
        drawDiscardBias:.40,
        targetStrategy:"leader"
    }
];

let targetScore=500;
let finalHandTriggered=false; // legacy variable
let recentActions=[];
let pendingActionCardIndex=null;
let lastActionPlayerIndex=null;
let lastActionTargetIndex=null;
let aiMemoryEnabled=true;

let gameStats={
    handsPlayed:0,
    showdowns:0,
    bestHand:"None",
    bestHandPoints:0,
    highestSingleHandScore:0
};




function renderPlayerNameInputs(){
    const humanSelect=document.getElementById('startHumanCount') || document.getElementById('startPlayerCount');
    const count=parseInt(humanSelect ? humanSelect.value : playerCount,10);
    const container=document.getElementById('playerNameInputs');
    if(!container) return;

    let html='';
    for(let i=0;i<count;i++){
        html += `<input type="text" id="playerName_${i}" placeholder="Player ${i+1}" value="${escapeHtml(playerNames[i]||'')}" style="width:100%;padding:10px;margin:6px 0;border-radius:8px;">`;
    }
    container.innerHTML=html;
}

function updateStartPlayerSetup(){
    const humanSelect=document.getElementById('startHumanCount');
    const aiSelect=document.getElementById('startAICount');
    const warning=document.getElementById('playerSetupWarning');

    let humans=parseInt(humanSelect ? humanSelect.value : 4,10);
    let ai=parseInt(aiSelect ? aiSelect.value : 0,10);

    if(humans + ai > 6){
        ai=Math.max(0,6-humans);
        if(aiSelect) aiSelect.value=String(ai);
    }

    if(humans + ai < 2){
        ai=1;
        if(aiSelect) aiSelect.value='1';
    }

    if(warning){
        warning.textContent=`Total Players: ${humans + ai} (${humans} human${humans===1?'':'s'}, ${ai} AI)`;
    }

    renderPlayerNameInputs();
}

function startGameFromStartScreen(){ startRoomAmbience(); AudioManager.play('shuffle', {volume:0.4});
    const humanSelect=document.getElementById("startHumanCount");
    const aiSelect=document.getElementById("startAICount");
    const targetSelect=document.getElementById("startTargetScore");
    const difficultySelect=document.getElementById("startAIDifficulty");

    humanPlayerCount=parseInt(humanSelect ? humanSelect.value : 4,10);
    aiPlayerCount=parseInt(aiSelect ? aiSelect.value : 0,10);

    if(humanPlayerCount + aiPlayerCount > 6){
        aiPlayerCount=Math.max(0,6-humanPlayerCount);
    }
    if(humanPlayerCount + aiPlayerCount < 2){
        aiPlayerCount=1;
    }

    playerCount=humanPlayerCount + aiPlayerCount;
    targetScore=parseInt(targetSelect.value,10);
    aiDifficulty=difficultySelect ? difficultySelect.value : "normal";

    for(let i=0;i<humanPlayerCount;i++){
        const el=document.getElementById('playerName_'+i);
        if(el && el.value.trim()){
            playerNames[i]=el.value.trim();
        }else{
            playerNames[i]='Player '+(i+1);
        }
    }

    for(let i=0;i<aiPlayerCount;i++){
        const identity=getAIIdentity(i);
        playerNames[humanPlayerCount+i]=identity.name || ('AI Player '+(i+1));
    }

    gameScores=Array(playerCount).fill(0);

    finalHandTriggered=false;
    handAlreadyScored=false;
    handOver=false;

    const results=document.getElementById("results");
    if(results) results.innerHTML="";

    const startScreen=document.getElementById("startScreen");
    if(startScreen) startScreen.style.display="none";

    updateRevealButtonVisibility();
    startNewHand();
}

function toggleSettings(){
    const content=document.getElementById('settingsContent');
    const btn=document.getElementById('settingsToggleBtn');

    if(content.style.display==='none'){
        content.style.display='block';
        btn.textContent='Hide Settings';
    }else{
        content.style.display='none';
        btn.textContent='⚙ Settings';
    }
}



function showGameOverModal(content){
 document.getElementById('gameOverBody').innerHTML=content;
 document.getElementById('gameOverModal').style.display='block';
}
function closeGameOverModal(){
 document.getElementById('gameOverModal').style.display='none';
}

function showHandCompleteModal(){
 document.getElementById('handCompleteModal').style.display='block';
}
function closeHandCompleteModal(){
 document.getElementById('handCompleteModal').style.display='none';
}

function openRules(){
document.getElementById('rulesModal').style.display='block';
}
function closeRules(){
document.getElementById('rulesModal').style.display='none';
}


function buildTargetPreviewCard(i){
 const p=players[i];
 const score=(gameScores[i]||0);
 const remaining=Math.max(0,targetScore-score);
 const handSize=(p.hand||[]).length;
 const skipCount=(p.effects && (p.effects.skipTurns || (p.effects.skip ? 1 : 0))) ? (p.effects.skipTurns || 1) : 0;

 return `<div>
 <div class="targetAIHeader">${aiBadgeHtml(p,true)}</div>
 Score: ${score}<br>
 Remaining: ${remaining}<br>
 Cards: ${handSize}
 ${p.isAI?'<br>Style: '+escapeHtml(p.personality+' • '+(getDifficultySettings(p.difficulty).label || 'Normal')):''}
 ${p.isAI && aiMemorySummary(p)?'<br>'+escapeHtml(aiMemorySummary(p)):''}
 ${skipCount>0?'<br>⏭️ Skip x'+skipCount:''}
 </div>`;
}

function sleep(ms){
    return new Promise(resolve=>setTimeout(resolve,ms));
}

function isAIPlayer(index=currentPlayerIndex){
    return players[index] && players[index].isAI;
}

function chooseAITarget(excludeSelf=true){
    const acting=players[currentPlayerIndex];
    let candidates=players
        .map((p,i)=>({p,i,score:gameScores[i]||0,handSize:(p.hand||[]).length}))
        .filter(x=>!excludeSelf || x.i!==currentPlayerIndex);

    if(!candidates.length) return currentPlayerIndex;

    const d=getDifficultySettings(acting && acting.difficulty);
    const smart=Math.random() <= d.smartTargeting;

    if(!smart || (acting && acting.targetStrategy==="random")){
        return randomChoice(candidates).i;
    }

    // If someone is close to winning, most smart AI will switch into stop-the-leader mode.
    const closest=getClosestToWinningIndex(excludeSelf);
    if(closest!==null && closest!==undefined && closest>=0){
        const needed=Math.max(0,targetScore-(gameScores[closest]||0));
        if(needed<=150 && Math.random()<.80){
            if(acting && acting.memory) acting.memory.leaderPressure=(acting.memory.leaderPressure||0)+1;
            return closest;
        }
    }

    // Some personalities retaliate when they remember who hit them.
    const grudge=getBiggestGrudgeTarget(acting,excludeSelf);
    if(grudge!==null && Math.random()<.70){
        return grudge;
    }

    if(acting && acting.targetStrategy==="threat"){
        candidates.sort((a,b)=>{
            const aThreat=(a.score*2)+(a.handSize*35);
            const bThreat=(b.score*2)+(b.handSize*35);
            return bThreat-aThreat;
        });
        return candidates[0].i;
    }

    candidates.sort((a,b)=>{
        if(b.score!==a.score) return b.score-a.score;
        return b.handSize-a.handSize;
    });
    return candidates[0].i;
}

function aiChooseDiscardIndex(player){
    const d=getDifficultySettings(player && player.difficulty);

    // Easy AI sometimes makes a messy discard.
    if(player.isAI && Math.random() > d.discardSkill){
        const legal=player.hand
            .map((c,i)=>({c,i}))
            .filter(x=>x.c.id!==lastDrawnFromDiscardId);
        if(legal.length) return randomChoice(legal).i;
    }

    let bestIndex=0;
    let bestScore=999;

    player.hand.forEach((card,i)=>{
        if(card.id===lastDrawnFromDiscardId) return;

        let score=scoreCardForDiscard(card);

        // Prefer dumping action cards with harsher penalties unless the personality likes them.
        if(card.category==="action"){
            const liked=(player.preferredActions || []).includes(card.action);
            score = liked ? 45 + Math.abs(card.penalty || 0) : 20 + Math.abs(card.penalty || 0);
        }

        // Keep wilds unless there is no better choice.
        if(card.category==="wild") score=120;

        if(score<bestScore){
            bestScore=score;
            bestIndex=i;
        }
    });

    return bestIndex;
}

function isAIActionPlayable(card){
    if(!card || card.category!=="action") return false;
    const a=card.action || "";

    if(a==="bonus_self" && currentPlayer() && (currentPlayer().hand||[]).length>=3){
        return false;
    }

    if(a==="bonus_targeted"){
        const target=chooseAITarget(true);
        if(!canReceiveBonusCard(target)){
            return false;
        }
    }

    if(a==="change_community" && (phase==="PRE-FLOP" || phase==="PRE_FLOP")){
        return false;
    }
    return true;
}

function aiChooseActionCardIndex(player){
    const preferred=(player.preferredActions && player.preferredActions.length)
        ? player.preferredActions
        : ["bonus_self","burn_targeted","skip","trade_hands","face_up_targeted","peek_targeted","full_reset_self","bonus_targeted","burn_all","pass_left","pass_right"];

    for(const action of preferred){
        const idx=player.hand.findIndex(c=>{
            if(c.category!=="action" || c.action!==action) return false;
            try{
                return isAIActionPlayable(c) && canPlayActionCard(c).valid;
            }catch(e){
                return false;
            }
        });
        if(idx>=0) return idx;
    }

    return -1;
}

function aiGetLegalDiscardIndexes(player){
    const legal=[];
    for(let i=0;i<player.hand.length;i++){
        const card=player.hand[i];

        if(card.category==="action"){
            try{
                if(isAIActionPlayable(card) && canPlayActionCard(card).valid){
                    legal.push(i);
                }
            }catch(e){}
            continue;
        }

        if(card.id!==lastDrawnFromDiscardId){
            legal.push(i);
        }
    }
    return legal;
}

async function runAITurnIfNeeded(){
    if(handOver) return;
    if(turnState==="MUST_DRAW" && getPendingSkipCount(currentPlayer())>0){ beginTurn(); return; }
    const player=currentPlayer();
    if(!player || !player.isAI) return;

    handRevealed=false;
    updateAll();

    log(playerDisplayName(player)+" is thinking... ("+(getDifficultySettings(player.difficulty).label || "Normal")+" "+player.personality+")");
    await sleep(getDifficultySettings().thinkingMs || 750);

    if(turnState==="MUST_DRAW"){
        const top=discardPile[discardPile.length-1];
        if(top && top.category!=="action" && Math.random()<getAIDrawDiscardChance(player)){
            drawFromDiscard();
        }else{
            drawFromDeck();
        }
        await sleep(600);
    }

    if(turnState!=="MUST_DISCARD" || handOver) return;

    for(let attempt=0; attempt<12 && turnState==="MUST_DISCARD" && !handOver; attempt++){
        const beforeHand=player.hand.length;

        const actionIndex=aiChooseActionCardIndex(player);

        if(actionIndex>=0 && Math.random()<getAIActionChance(player)){
            try{ await discardCard(actionIndex,true); }catch(e){}
        }else{
            const legalMoves=aiGetLegalDiscardIndexes(player);

            if(legalMoves.length){
                const discardIndex=legalMoves.includes(aiChooseDiscardIndex(player))
                    ? aiChooseDiscardIndex(player)
                    : legalMoves[0];

                try{ await discardCard(discardIndex,true); }catch(e){}
            }
        }

        await sleep(150);

        if(turnState!=="MUST_DISCARD" || handOver){
            return;
        }

        const legalDiscard=player.hand.findIndex(c=>c.id!==lastDrawnFromDiscardId);
        if(legalDiscard>=0){
            try{ await discardCard(legalDiscard,true); }catch(e){}
        }

        await sleep(150);

        if(turnState!=="MUST_DISCARD" || handOver){
            return;
        }
    }

    const emergency=player.hand.findIndex(c=>c.id!==lastDrawnFromDiscardId);
    if(emergency>=0){
        try{ await discardCard(emergency,true); }catch(e){}
    }
}


function currentPlayer(){ return players[currentPlayerIndex]; }


function resolveAIDifficulty(){
    if(aiDifficulty!=="random") return aiDifficulty;
    const choices=["easy","normal","hard","expert"];
    return choices[Math.floor(Math.random()*choices.length)];
}


function ensureAIMemory(player){
    if(!player) return null;
    if(!player.memory){
        player.memory={
            grudges:{},
            targetedBy:{},
            actionsPlayed:0,
            lastTarget:null,
            leaderPressure:0
        };
    }
    return player.memory;
}

function rememberAction(actorIndex,targetIndex,action){
    if(!aiMemoryEnabled) return;
    if(actorIndex===null || actorIndex===undefined) return;

    lastActionPlayerIndex=actorIndex;
    lastActionTargetIndex=targetIndex;

    const actor=players[actorIndex];
    if(actor && actor.isAI){
        const mem=ensureAIMemory(actor);
        mem.actionsPlayed++;
        mem.lastTarget=targetIndex;
    }

    if(targetIndex===null || targetIndex===undefined) return;
    const target=players[targetIndex];
    if(target && target.isAI && actorIndex!==targetIndex){
        const mem=ensureAIMemory(target);
        mem.grudges[actorIndex]=(mem.grudges[actorIndex]||0)+1;
        mem.targetedBy[actorIndex]=(mem.targetedBy[actorIndex]||0)+1;
    }
}

function getLeaderIndex(excludeSelf=true){
    let best=-1;
    let bestScore=-Infinity;
    players.forEach((p,i)=>{
        if(excludeSelf && i===currentPlayerIndex) return;
        const score=gameScores[i]||0;
        if(score>bestScore){
            bestScore=score;
            best=i;
        }
    });
    return best;
}

function getClosestToWinningIndex(excludeSelf=true){
    let best=-1;
    let bestNeeded=Infinity;
    players.forEach((p,i)=>{
        if(excludeSelf && i===currentPlayerIndex) return;
        const needed=Math.max(0,targetScore-(gameScores[i]||0));
        if(needed<bestNeeded){
            bestNeeded=needed;
            best=i;
        }
    });
    return best;
}

function getBiggestGrudgeTarget(player,excludeSelf=true){
    if(!player || !player.memory || !player.memory.grudges) return null;
    let best=null;
    let bestValue=0;
    Object.keys(player.memory.grudges).forEach(key=>{
        const idx=parseInt(key,10);
        if(excludeSelf && idx===currentPlayerIndex) return;
        if(!players[idx]) return;
        const value=player.memory.grudges[key]||0;
        if(value>bestValue){
            bestValue=value;
            best=idx;
        }
    });
    return bestValue>0 ? best : null;
}

function decayAIMemory(){
    players.forEach(p=>{
        if(!p || !p.isAI || !p.memory) return;
        Object.keys(p.memory.grudges).forEach(k=>{
            p.memory.grudges[k]=Math.max(0,p.memory.grudges[k]-0.25);
            if(p.memory.grudges[k]===0) delete p.memory.grudges[k];
        });
        p.memory.leaderPressure=Math.max(0,(p.memory.leaderPressure||0)-0.1);
    });
}

function aiMemorySummary(player){
    if(!player || !player.isAI || !player.memory) return "";
    const grudgeTarget=getBiggestGrudgeTarget(player,true);
    if(grudgeTarget!==null && players[grudgeTarget]){
        return "Remembers: "+players[grudgeTarget].name;
    }
    return "";
}

function getDifficultySettings(level){
    const key=level || aiDifficulty;
    return AI_DIFFICULTY_SETTINGS[key] || AI_DIFFICULTY_SETTINGS.normal;
}

function getAIIdentity(index){
    return AI_IDENTITIES[index % AI_IDENTITIES.length];
}

function playerAvatar(player){
    if(!player) return "👤";
    return player.avatar || (player.isAI ? "🤖" : "👤");
}

function playerColor(player){
    if(!player) return "#666";
    return player.color || (player.isAI ? "#64748b" : "#475569");
}

function playerDisplayName(player){
    if(!player) return "Player";
    if(player.isAI){
        return playerAvatar(player)+" "+player.name;
    }
    return "👤 "+player.name;
}

function aiBadgeHtml(player, small=false){
    if(!player) return "";
    const avatar=escapeHtml(playerAvatar(player));
    const color=escapeHtml(playerColor(player));
    const cls=small ? "aiAvatarChip scoreAvatar" : "aiAvatarChip";
    const name=escapeHtml(player.name);
    const personality=escapeHtml(player.personality || "");
    const label=player.isAI && player.personality ? `<span>${name}<br><span class="aiPersonalityTag">${personality}</span></span>` : `<span>${name}</span>`;
    return `<span class="aiBadge"><span class="${cls}" style="background:${color};">${avatar}</span>${label}</span>`;
}

function getAIActionChance(player){
    const d=getDifficultySettings(player && player.difficulty);
    const personalityBoost = player && player.actionAggression!==undefined ? player.actionAggression : 0;
    return Math.max(.05, Math.min(.98, d.actionChance + personalityBoost));
}

function getAIDrawDiscardChance(player){
    const d=getDifficultySettings(player && player.difficulty);
    const personalityBias = player && player.drawDiscardBias!==undefined ? player.drawDiscardBias : .30;
    return Math.max(.05, Math.min(.85, (personalityBias + d.drawDiscardBonus) / 2));
}

function scoreCardForDiscard(card){
    if(!card) return 99;
    if(card.category==="action") return 30 + Math.abs(card.penalty || 0);
    if(card.category==="wild") return 100;

    const rankMap={"2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"10":10,"J":11,"Q":12,"K":13,"A":14};
    if(card.category==="standard"){
        const rankText=card.name.slice(0,-1);
        return rankMap[rankText] || 8;
    }
    return 8;
}

function randomChoice(arr){
    return arr[Math.floor(Math.random()*arr.length)];
}


function renderRecentActions(){
    const panel=document.getElementById("recentActionsFeed");
    if(!panel) return;

    if(!recentActions.length){
        panel.innerHTML="<div class='recentActionItem'>No actions yet.</div>";
    }else{
        panel.innerHTML=recentActions.map(a=>`<div class="recentActionItem">${escapeHtml(a)}</div>`).join("");
    }

    requestAnimationFrame(()=>{
        panel.scrollTop=panel.scrollHeight;
    });
}

function getNextStepText(){
    if(handOver) return "Start Next Hand";
    if(turnState==="MUST_DRAW") return "Draw a Card";
    if(turnState==="MUST_DISCARD") return "Discard a Card";
    if(turnState==="TURN_COMPLETE") return "Pass Device";
    return "Continue";
}

function getWhatHappensNextText(){
    if(turnState==="MUST_DRAW") return "Then discard one card to finish your turn.";
    if(turnState==="MUST_DISCARD") return "Click one glowing card. Action Cards will explain themselves before they play.";
    if(phase==="RIVER") return "After every player acts, the hand scores automatically.";
    return "After every player acts, the next community card stage will reveal.";
}


function actionIconFor(card){
    const icons={
        skip:"⏭️",
        trade_hands:"🤝",
        pass_left:"⬅️",
        pass_right:"➡️",
        burn_targeted:"🔥",
        burn_all:"🔥",
        full_reset_targeted:"🔄",
        full_reset_self:"🔄",
        full_reset_all:"🔄",
        bonus_targeted:"➕",
        bonus_self:"➕",
        change_community:"🃏",
        face_up_targeted:"👁️",
        face_up_self:"👁️",
        peek_targeted:"🔍"
    };
    return icons[card.action] || "⚡";
}

function playActionAnimation(card, playerName){
    return new Promise(resolve=>{
        const layer=document.getElementById("actionAnimationLayer");
        if(!layer){
            resolve();
            return;
        }

        const title=document.getElementById("actionAnimTitle");
        const icon=document.getElementById("actionAnimIcon");
        const penalty=document.getElementById("actionAnimPenalty");
        const text=document.getElementById("actionAnimText");

        title.innerText=card.name || "Action Card";
        icon.innerText=actionIconFor(card);
        penalty.innerText=card.penalty ? card.penalty : "";
        text.innerText=(playerName || "Player")+" played "+(card.name || "an Action Card")+"!";

        layer.style.display="block";

        const currentSeat=document.querySelector(".seat.currentPlayer");
        if(currentSeat){
            currentSeat.classList.remove("actionPulse");
            void currentSeat.offsetWidth;
            currentSeat.classList.add("actionPulse");
        }

        setTimeout(()=>{
            layer.style.display="none";
            if(currentSeat) currentSeat.classList.remove("actionPulse");
            resolve();
        }, 950);
    });
}


async function playUniqueActionAnimation(card){
 if(card && card.action){
   if(card.action.includes('burn')) AudioManager.play('burn', {volume:0.55});
   else if(card.action==='trade_hands' || card.action.includes('full_reset')) AudioManager.play('trade', {volume:0.55});
   else AudioManager.play('action', {volume:0.55});
 }
 return new Promise(resolve=>{
   const overlay=document.getElementById('fxOverlay');
   const center=document.getElementById('fxCenter');
   if(!overlay||!center){resolve();return;}

   let cls='fxCenter';
   let txt='⚡';

   if(card.action && card.action.includes('burn')){
      cls+=' fxBurn'; txt='🔥🔥🔥';
   }else if(card.action==='trade_hands'){
      cls+=' fxTrade'; txt='🤝 ⇄ 🃏';
   }else if(card.action && card.action.includes('full_reset')){
      cls+=' fxReset'; txt='🔄🃏🔄';
   }else if(card.action && card.action.includes('bonus')){
      txt='➕🃏';
   }else if(card.action==='pass_left'){
      txt='⬅️⬅️⬅️';
   }else if(card.action==='pass_right'){
      txt='➡️➡️➡️';
   }else if(card.action==='skip'){
      txt='⛔ SKIPPED';
   }else if(card.action==='change_community'){
      txt='🃏↺';
   }else if(card.action && card.action.includes('face_up')){
      txt='👁️';
   }else if(card.action && card.action.includes('peek')){
      txt='🔍';
   }

   center.className=cls;
   center.innerHTML=txt;
   overlay.style.display='block';

   setTimeout(()=>{
      overlay.style.display='none';
      resolve();
   },1200);
 });
}


function getRectCenter(el){
    if(!el){
        return {x:window.innerWidth/2,y:window.innerHeight/2};
    }
    const r=el.getBoundingClientRect();
    return {x:r.left+r.width/2,y:r.top+r.height/2};
}

function getCurrentSeatElement(){
    return document.querySelector(".seat.currentPlayer");
}

function getTargetSeatElement(){
    // Best effort. Target selection happens inside individual card effects and is not always stored.
    // So this highlights the table center when the exact target is not available.
    return document.querySelector(".seat.currentPlayer");
}

function createMotionCard(layer, x, y){
    const card=document.createElement("div");
    card.className="motionCard";
    card.style.left=(x-35)+"px";
    card.style.top=(y-49)+"px";
    layer.appendChild(card);
    return card;
}

function animateElementTo(el, from, to, ms=950, rotate=0){
    el.animate([
        {left:(from.x-35)+"px", top:(from.y-49)+"px", transform:"scale(.75) rotate(0deg)", opacity:0},
        {opacity:1, offset:.18},
        {left:(to.x-35)+"px", top:(to.y-49)+"px", transform:`scale(1.08) rotate(${rotate}deg)`, opacity:1, offset:.78},
        {left:(to.x-35)+"px", top:(to.y-49)+"px", transform:`scale(.7) rotate(${rotate}deg)`, opacity:0}
    ], {duration:ms, easing:"ease-out", fill:"forwards"});
}

function showMotionLabel(layer, text){
    const label=document.createElement("div");
    label.className="motionLabel";
    label.innerText=text;
    layer.appendChild(label);
}

function playTableMotionAnimation(card, playerName){
    return new Promise(resolve=>{
        const layer=document.getElementById("tableMotionLayer");
        if(!layer){
            resolve();
            return;
        }

        layer.innerHTML="";
        layer.style.display="block";

        const actorSeat=getCurrentSeatElement();
        const actor=getRectCenter(actorSeat);
        const tableCenter={x:window.innerWidth/2,y:window.innerHeight/2};
        const deckEl=document.getElementById("drawBtn");
        const discardEl=document.getElementById("discard");
        const deck=getRectCenter(deckEl);
        const discard=getRectCenter(discardEl);

        const action=card.action || "";
        const name=card.name || "Action Card";

        showMotionLabel(layer, `${playerName || "Player"} played ${name}`);

        if(action.includes("burn")){
            const c=createMotionCard(layer, actor.x, actor.y);
            animateElementTo(c, actor, discard, 1050, 18);

            for(let i=0;i<8;i++){
                const flame=document.createElement("div");
                flame.className="motionFlame";
                flame.innerText="🔥";
                flame.style.left=(discard.x-30+Math.random()*60)+"px";
                flame.style.top=(discard.y-60+Math.random()*60)+"px";
                flame.style.animationDelay=(i*.06)+"s";
                layer.appendChild(flame);
            }
        }else if(action==="trade_hands"){
            const left={x:actor.x-190,y:actor.y};
            const right={x:actor.x+190,y:actor.y};
            const c1=createMotionCard(layer,left.x,left.y);
            const c2=createMotionCard(layer,right.x,right.y);
            animateElementTo(c1,left,right,1150,16);
            animateElementTo(c2,right,left,1150,-16);
        }else if(action==="pass_left" || action==="pass_right"){
            const ring=document.createElement("div");
            ring.className="motionArrowRing";
            ring.setAttribute("data-arrow", action==="pass_left" ? "⬅️" : "➡️");
            layer.appendChild(ring);

            const seats=[...document.querySelectorAll(".seat")].slice(0,6);
            const centers=seats.map(getRectCenter);
            centers.forEach((from,i)=>{
                const to=centers[(i+(action==="pass_left"?1:-1)+centers.length)%centers.length] || tableCenter;
                const c=createMotionCard(layer,from.x,from.y);
                animateElementTo(c,from,to,1200, action==="pass_left" ? -20 : 20);
            });
        }else if(action.includes("full_reset")){
            for(let i=0;i<3;i++){
                const c=createMotionCard(layer, actor.x+(i*18)-18, actor.y);
                animateElementTo(c, {x:actor.x+(i*18)-18,y:actor.y}, discard, 900, 25);
            }
            setTimeout(()=>{
                for(let i=0;i<2;i++){
                    const c=createMotionCard(layer, deck.x, deck.y);
                    animateElementTo(c, deck, actor, 750, -15);
                }
            },450);
        }else if(action.includes("bonus")){
            const plus=document.createElement("div");
            plus.className="motionPlus";
            plus.innerText="+1";
            plus.style.left=(actor.x-35)+"px";
            plus.style.top=(actor.y-95)+"px";
            layer.appendChild(plus);

            const c=createMotionCard(layer, deck.x, deck.y);
            animateElementTo(c, deck, actor, 1000, -10);
        }else if(action==="skip"){
            const stamp=document.createElement("div");
            stamp.className="motionStamp";
            stamp.innerText="SKIPPED";
            layer.appendChild(stamp);
        }else if(action==="change_community"){
            const c=createMotionCard(layer, tableCenter.x, tableCenter.y);
            c.innerHTML="↺";
            c.style.fontSize="46px";
            c.animate([
                {transform:"scale(.4) rotate(0deg)", opacity:0},
                {transform:"scale(1.25) rotate(180deg)", opacity:1},
                {transform:"scale(.7) rotate(360deg)", opacity:0}
            ], {duration:1200,easing:"ease-out",fill:"forwards"});
        }else if(action.includes("peek") || action.includes("face_up")){
            const eye=document.createElement("div");
            eye.className="motionEye";
            eye.innerText= action.includes("peek") ? "🔍" : "👁️";
            layer.appendChild(eye);
        }else{
            const c=createMotionCard(layer, actor.x, actor.y);
            animateElementTo(c, actor, tableCenter, 900, 12);
        }

        setTimeout(()=>{
            layer.style.display="none";
            layer.innerHTML="";
            resolve();
        },1400);
    });
}


function playOpeningDealAnimation(){
    if(window.AudioManager) AudioManager.play('shuffle', {volume:0.35, cooldown:250}); playSound('shuffleSound',0.5);
 playShuffleSound();
 return new Promise(resolve=>{
   const layer=document.getElementById("openingDealLayer");
   if(!layer){ resolve(); return; }

   // Wait a tick so updateAll() has rendered the correct seats for 2, 3, 4, 5, or 6 players.
   setTimeout(()=>{
     layer.innerHTML="";
     layer.style.display="block";

     const label=document.createElement("div");
     label.className="openingDealLabel";
     label.innerText="DEALING CARDS";
     layer.appendChild(label);

     const deckBtn=document.getElementById("drawBtn");
     const deckRect=deckBtn ? deckBtn.getBoundingClientRect() : {left:120,top:window.innerHeight-250,width:90,height:130};

     const seats=[...document.querySelectorAll(".seat")].slice(0, playerCount);

     if(!seats.length){
        layer.style.display="none";
        resolve();
        return;
     }

     const startX=deckRect.left + deckRect.width/2 - 35;
     const startY=deckRect.top + deckRect.height/2 - 49;

     let delay=0;

     for(let round=0; round<2; round++){
        seats.forEach((seat)=>{
           const r=seat.getBoundingClientRect();

           const card=document.createElement("div");
           card.className="openingDealCard";
           card.style.left=startX+"px";
           card.style.top=startY+"px";
           layer.appendChild(card);

           const targetX=r.left + r.width/2 - 35;
           const targetY=r.top + r.height/2 - 49;

           card.animate([
             {left:startX+"px", top:startY+"px", transform:"rotate(-18deg) scale(.55)", opacity:0},
             {left:startX+"px", top:startY+"px", transform:"rotate(-18deg) scale(.75)", opacity:1, offset:.15},
             {left:targetX+"px", top:targetY+"px", transform:"rotate(6deg) scale(1)", opacity:1, offset:.78},
             {left:targetX+"px", top:targetY+"px", transform:"rotate(0deg) scale(.8)", opacity:0}
           ],{
             duration:520,
             delay:delay,
             fill:"forwards",
             easing:"ease-out"
           });

           delay += 135;
        });
     }

     setTimeout(()=>{
        layer.style.display="none";
        layer.innerHTML="";
        resolve();
     }, delay + 450);

   }, 80);
 });
}

function playStreetDealAnimation(street){ playSound('flipSound',0.5);
 playCardFlipSound();
 return new Promise(resolve=>{
   const layer=document.getElementById('streetDealLayer');
   if(!layer){ resolve(); return; }

   layer.innerHTML='';
   layer.style.display='block';

   const label=document.createElement('div');
   label.className='streetDealLabel';
   label.innerText = street==='FLOP' ? 'DEALING THE FLOP' : street==='TURN' ? 'DEALING THE TURN' : 'DEALING THE RIVER';
   layer.appendChild(label);

   const deckBtn=document.getElementById('drawBtn');
   const deckRect=deckBtn ? deckBtn.getBoundingClientRect() : {left:120,top:window.innerHeight-260,width:90,height:130};

   const board=document.getElementById('communityRow');
   const boardRect=board ? board.getBoundingClientRect() : {left:window.innerWidth/2-220,top:window.innerHeight/2-75,width:440,height:150};

   const count = street==='FLOP' ? 3 : 1;
   const startX = deckRect.left + deckRect.width/2 - 45;
   const startY = deckRect.top + deckRect.height/2 - 65;

   for(let i=0;i<count;i++){
      const card=document.createElement('div');
      card.className='dealAnimCard';
      card.style.left=startX+'px';
      card.style.top=startY+'px';
      layer.appendChild(card);

      const totalWidth = count * 100;
      const targetX = boardRect.left + boardRect.width/2 - totalWidth/2 + (i*100);
      const targetY = boardRect.top + 12;

      card.animate([
        {left:startX+'px', top:startY+'px', transform:'rotate(-18deg) scale(.55)', opacity:0},
        {left:startX+'px', top:startY+'px', transform:'rotate(-18deg) scale(.75)', opacity:1, offset:.12},
        {left:targetX+'px', top:targetY+'px', transform:'rotate(8deg) scale(1)', opacity:1, offset:.70},
        {left:targetX+'px', top:targetY+'px', transform:'rotateY(180deg) scale(1.05)', opacity:1, offset:.86},
        {left:targetX+'px', top:targetY+'px', transform:'rotateY(360deg) scale(1)', opacity:0}
      ],{
        duration:1050+(i*160),
        delay:i*110,
        easing:'ease-out',
        fill:'forwards'
      });
   }

   const totalTime = street==='FLOP' ? 1750 : 1350;
   setTimeout(()=>{
      layer.style.display='none';
      layer.innerHTML='';
      resolve();
   }, totalTime);
 });
}

function actionCardDescription(card){
    const descriptions={
        skip:"Target player loses their next turn.",
        trade_hands:"Swap your hand with another player.",
        pass_left:"Everyone passes their hand to the left.",
        pass_right:"Everyone passes their hand to the right.",
        burn_targeted:"Target player loses one random card.",
        burn_all:"All opponents with enough cards lose one random card.",
        full_reset_targeted:"Target player burns their hand and draws 2 new cards.",
        full_reset_self:"You burn your hand and draw 2 new cards.",
        full_reset_all:"All other players burn their hands and draw 2 new cards.",
        bonus_targeted:"Target player draws one extra card.",
        bonus_self:"You draw one extra card.",
        change_community:"Replace one revealed community card.",
        face_up_targeted:"Target player's hand stays visible.",
        face_up_self:"Your hand stays visible.",
        peek_targeted:"View another player's hand."
    };
    return descriptions[card.action] || "Play this Action Card.";
}

function showStreetModal(){ return; }

function closeStreetModal(){ return; }

function showActionHelpModal(card,index){
    pendingActionCardIndex=index;
    document.getElementById("actionHelpTitle").innerText=card.name;
    document.getElementById("actionHelpText").innerText=actionCardDescription(card);
    document.getElementById("actionHelpPenalty").innerText="Penalty: "+card.penalty+" points";
    document.getElementById("actionHelpModal").style.display="block";
}

function cancelActionCard(){
    pendingActionCardIndex=null;
    document.getElementById("actionHelpModal").style.display="none";
}

function previewActionCard(index){
    const card=currentPlayer().hand[index];
    if(!card) return;
    showActionHelpModal(card,index);
}

function confirmActionCard(){
    const idx=pendingActionCardIndex;
    pendingActionCardIndex=null;
    document.getElementById("actionHelpModal").style.display="none";
    if(idx!==null && idx!==undefined){
        discardCard(idx,true);
    }
}


function getPendingSkipCount(player){
    if(!player || !player.effects) return 0;
    return player.effects.skipTurns || (player.effects.skip ? 1 : 0) || 0;
}

function addSkipToPlayer(playerIndex){
    const p=players[playerIndex];
    if(!p) return;
    p.effects.skipTurns=(p.effects.skipTurns||0)+1;
    p.effects.skip=true;
}

function consumeCurrentPlayerSkip(){
    const p=currentPlayer();
    if(!p || !p.effects) return false;

    const count=getPendingSkipCount(p);
    if(count<=0) return false;

    if((p.effects.skipTurns||0)>0){
        p.effects.skipTurns=Math.max(0,p.effects.skipTurns-1);
    }else{
        p.effects.skipTurns=0;
    }

    p.effects.skip=p.effects.skipTurns>0;

    log("⏭️ "+p.name+" was skipped.");
    return true;
}

function beginTurn(){
    if(handOver) return;

    let safety=0;

    while(safety<players.length && consumeCurrentPlayerSkip()){
        turnsTakenThisRound++;

        if(turnsTakenThisRound>=players.length){
            autoRevealNextStreet();
            return;
        }

        advanceToNextPlayer();
        safety++;
    }

    turnState="MUST_DRAW";
    lastDrawnFromDiscardId=null;
    ensureDiscardTopPlayable();
    handRevealed=false;

    updateAll();
    setTimeout(showTurnModal,100);
}


function showTurnModal(){
    if(handOver) return;

    if(turnState==="MUST_DRAW" && getPendingSkipCount(currentPlayer())>0){
        beginTurn();
        return;
    }

    const modal=document.getElementById("turnModal");
    if(modal) modal.style.display="none";

    if(isAIPlayer()){
        handRevealed=false;
        updateAll();
        setTimeout(runAITurnIfNeeded,500);
        return;
    }

    updateAll();
}

function closeTurnModalAndReveal(){
    revealCurrentHand();
}


function updateRevealButtonVisibility(){
    const btn=document.getElementById('revealToggleBtn');
    if(!btn) return;

    if(humanPlayerCount===1){
        handRevealed=true;
        btn.style.display='none';
    }else{
        btn.style.display='inline-block';
        btn.innerText=handRevealed ? '🙈 Hide Cards' : '👁 Reveal Cards';
    }
}

function toggleHandReveal(){
    handRevealed=!handRevealed;
    const btn=document.getElementById("revealToggleBtn");
    if(btn){
        btn.innerText=handRevealed ? "🙈 Hide Cards" : "👁 Reveal Cards";
    }
    updateAll();
}

function log(message){
    try{
        const logEl=document.getElementById("log");
        if(logEl){
            logEl.innerHTML=escapeHtml(message)+"<br>"+logEl.innerHTML;
        }
    }catch(e){}

    recentActions.unshift(message);
    recentActions=recentActions.slice(0,10);
    renderRecentActions();
}
function createCard(card){ return {id:nextCardId++,...card}; }

function createDeck(){
    deck=[]; nextCardId=1;

    if(!window.ActionHoldemCards || !window.ActionHoldemCards.createDeckCards){
        throw new Error("ActionHoldemCards module is required before main.js");
    }

    deck=window.ActionHoldemCards.createDeckCards(createCard);
    console.log("Deck Size:",deck.length);
}

function shuffle(array){ for(let i=array.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [array[i],array[j]]=[array[j],array[i]]; } }



function revealCurrentHand(){
    handRevealed=true;
    updateAll();
}

function hideCurrentHand(){
    handRevealed=false;
    updateAll();
}

function startNewGame(){
    gameScores=Array(playerCount).fill(0);
    finalHandTriggered=false;
    handAlreadyScored=false;
    handOver=false;
    document.getElementById("results").innerHTML="";
    log("New game started. Scores reset to 0.");
    startNewHand();
}

function startNewHand(){

    dealerIndex=(dealerIndex+1)%playerCount;

    handOver = false;
    handAlreadyScored = false;
    handRevealed = false;
    turnsTakenThisRound = 0;

    while(gameScores.length < playerCount){
        gameScores.push(0);
    }

    if(gameScores.length > playerCount){
        gameScores = gameScores.slice(0, playerCount);
    }

    createDeck(); shuffle(deck);
    players=[];

    for(let i=0;i<playerCount;i++){
        const isAI = i >= humanPlayerCount;
        const identity = isAI ? getAIIdentity(i-humanPlayerCount) : null;

        players.push({
            name: isAI ? identity.name : (playerNames[i] || ("Player "+(i+1))),
            hand: [],
            isAI: isAI,
            aiId: identity ? identity.id : null,
            avatar: identity ? identity.avatar : "👤",
            color: identity ? identity.color : "#475569",
            personality: identity ? identity.personality : "Human",
            aiDescription: identity ? identity.description : "",
            preferredActions: identity ? identity.preferredActions : [],
            drawDiscardBias: identity ? identity.drawDiscardBias : .30,
            targetStrategy: identity ? identity.targetStrategy : "leader",
            actionAggression: identity && identity.personality==="Chaotic" ? .08 : 0,
            difficulty: resolveAIDifficulty(),
            memory:{grudges:{},targetedBy:{},actionsPlayed:0,lastTarget:null,leaderPressure:0},
            effects:{faceUp:false, skip:false, skipTurns:0, bonus:false}
        });
    }
    currentPlayerIndex=0;
    discardPile=[]; burnPile=[]; flop=[]; turnCard=null; riverCard=null;
    phase="PRE-FLOP"; turnState="MUST_DRAW"; lastDrawnFromDiscardId=null;
    for(let p of players){ p.hand.push(deck.pop()); p.hand.push(deck.pop()); }
    createInitialDiscard();
    decayAIMemory();
    gameStats.handsPlayed++;
    log("New hand started");
    document.getElementById("results").innerHTML="";
    updateAll();
    playOpeningDealAnimation().then(()=>{
        beginTurn();
    });
}

function createInitialDiscard(){
    while(deck.length>0){
        const card=deck.pop();
        if(card.category==="action"){ burnPile.push(card); log("Initial discard was Action Card; burned "+card.name); continue; }
        discardPile.push(card); log("Initial discard set: "+card.name); return;
    }
}

function ensureDiscardTopPlayable(){
    while(discardPile.length>0){
        const topCard=discardPile[discardPile.length-1];
        if(topCard.category!=="action") return;
        const burned=discardPile.pop(); burnPile.push(burned);
        log("Top discard was Action Card; burned "+burned.name);
        if(deck.length>0){ discardPile.push(deck.pop()); log("Replaced top discard from deck"); }
    }
}

function advanceToNextPlayer(){

    currentPlayerIndex=(currentPlayerIndex+1)%players.length;
}

function moveToNextAvailablePlayer(){

    let checkedPlayers = 0;

    while(checkedPlayers < players.length){

        advanceToNextPlayer();

        if(currentPlayer().effects.skip){

            log(currentPlayer().name+" was skipped.");

            currentPlayer().effects.skip=false;

            turnsTakenThisRound++;

            checkedPlayers++;

            if(turnsTakenThisRound>=players.length){

                return false;
            }

            continue;
        }

        return true;
    }

    return false;
}


function autoRevealNextStreet(){

    turnsTakenThisRound=0;
    currentPlayerIndex=0;
    turnState="MUST_DRAW";
    lastDrawnFromDiscardId=null;
    handRevealed=false;

    if(phase==="PRE-FLOP"){

        burnCard();

        flop=[
            drawValidCommunityCard(),
            drawValidCommunityCard(),
            drawValidCommunityCard()
        ].filter(Boolean);

        phase="FLOP";

        ensureDiscardTopPlayable();

        log("Flop automatically revealed.");

        playStreetDealAnimation("FLOP").then(()=>{
            updateAll();
            showStreetModal("FLOP REVEALED","3 community cards added. Player 1 starts the Flop round.");
            beginTurn();
        });

        return;
    }

    if(phase==="FLOP"){

        burnCard();

        turnCard=drawValidCommunityCard();

        phase="TURN";

        ensureDiscardTopPlayable();

        log("Turn automatically revealed.");

        playStreetDealAnimation("TURN").then(()=>{
            updateAll();
            showStreetModal("TURN REVEALED","1 community card added. Player 1 starts the Turn round.");
            beginTurn();
        });

        return;
    }

    if(phase==="TURN"){

        burnCard();

        riverCard=drawValidCommunityCard();

        phase="RIVER";

        ensureDiscardTopPlayable();

        log("River automatically revealed.");

        playStreetDealAnimation("RIVER").then(()=>{
            updateAll();
            showStreetModal("RIVER REVEALED","Final community card added. After this round, the hand scores automatically.");
            beginTurn();
        });

        return;
    }

    if(phase==="RIVER"){

        turnState="TURN_COMPLETE";

        log("Final river round complete. Scoring hand automatically.");

        updateAll();

        showdown();

        return;
    }
}

function startNextTurn(){
    // Button removed in v3.3.4. This remains only as a backup helper.
    if(handOver){ alert("Hand is over. Start the next hand."); return; }

    if(turnState!=="TURN_COMPLETE"){ alert("Current turn is not complete yet."); return; }

    autoAdvanceAfterDiscard();
}

function autoAdvanceAfterDiscard(){

    if(handOver){
        updateAll();
        return;
    }

    log(currentPlayer().name+" completed their turn.");

    turnsTakenThisRound++;

    if(turnsTakenThisRound>=players.length){
        autoRevealNextStreet();
        return;
    }

    advanceToNextPlayer();

    log("Pass device to "+currentPlayer().name+".");

    beginTurn();
}


function drawFromDeck(){ AudioManager.play('drawDeck', {volume:0.45});
    if(turnState==="MUST_DRAW" && getPendingSkipCount(currentPlayer())>0){ beginTurn(); return; }
    if(handOver){ alert("Hand is over. Start the next hand."); return; }

    if(turnState!=="MUST_DRAW"){ alert("You must discard before drawing again."); return; }
    if(currentPlayer().hand.length >= MAX_HAND_CARDS + 1){
        turnState="MUST_DISCARD";
        alert(handLimitMessage(currentPlayer()));
        updateAll();
        return;
    }
    if(deck.length===0){ alert("Deck Empty"); return; }
    const card=deck.pop();
    currentPlayer().hand.push(card);
    lastDrawnFromDiscardId=null;
    turnState="MUST_DISCARD";
    log(currentPlayer().name+" drew from deck");
    updateAll();
}

function drawFromDiscard(){ AudioManager.play('drawDiscard', {volume:0.45});
    if(turnState==="MUST_DRAW" && getPendingSkipCount(currentPlayer())>0){ beginTurn(); return; }
    if(handOver){ alert("Hand is over. Start the next hand."); return; }

    if(turnState!=="MUST_DRAW"){ alert("You must discard before drawing again."); return; }
    if(currentPlayer().hand.length >= MAX_HAND_CARDS + 1){
        turnState="MUST_DISCARD";
        alert(handLimitMessage(currentPlayer()));
        updateAll();
        return;
    }
    if(discardPile.length===0){ alert("Discard pile empty."); return; }
    const topCard=discardPile[discardPile.length-1];
    if(topCard.category==="action"){ alert("You cannot draw an Action Card from the discard pile."); return; }
    const card=discardPile.pop();
    currentPlayer().hand.push(card);
    lastDrawnFromDiscardId=card.id;
    turnState="MUST_DISCARD";
    log(currentPlayer().name+" drew from discard: "+card.name);
    updateAll();
}


let targetSelectionCallback=null;

function chooseTarget(excludeSelf=true){
    if(isAIPlayer()){
        return Promise.resolve(chooseAITarget(excludeSelf));
    }

    const modal=document.getElementById('targetModal');
    const buttons=document.getElementById('targetButtons');

    return new Promise(resolve=>{
        targetSelectionCallback=resolve;
        buttons.innerHTML='';

        players.forEach((p,i)=>{
            if(excludeSelf && i===currentPlayerIndex) return;

            const btn=document.createElement('button');
            btn.className='targetBtn';
            btn.innerHTML=buildTargetPreviewCard(i);

            const pendingCard = currentPlayer() && pendingActionCardIndex!==null && pendingActionCardIndex!==undefined
                ? currentPlayer().hand[pendingActionCardIndex]
                : null;

            if(pendingCard && pendingCard.action==="bonus_targeted" && !canReceiveBonusCard(i)){
                btn.disabled=true;
                btn.innerHTML += "<br><strong>Blocked: already at "+MAX_HAND_CARDS+" cards</strong>";
            }

            btn.onclick=()=>{
                if(btn.disabled) return;
                modal.style.display='none';
                resolve(i);
            };
            buttons.appendChild(btn);
        });

        modal.style.display='block';
    });
}

function cancelTargetSelection(){
    document.getElementById('targetModal').style.display='none';
    if(targetSelectionCallback){
        targetSelectionCallback(null);
        targetSelectionCallback=null;
    }
}


function burnRandomCardFromPlayer(playerIndex){

    const targetPlayer = players[playerIndex];

    if(targetPlayer.hand.length <= 1){

        log(targetPlayer.name+" has only one card and cannot be burned.");
        return false;
    }

    const randomIndex =
        Math.floor(Math.random() * targetPlayer.hand.length);

    const burnedCard =
        targetPlayer.hand.splice(randomIndex,1)[0];

    burnPile.push(burnedCard);

    log(targetPlayer.name+" burned one random card.");

    return true;
}

async function chooseCommunityCard(){

    const availableCards=[];

    flop.forEach((card,index)=>availableCards.push({label:'Flop '+(index+1)+': '+card.name,area:'flop',index:index}));
    if(turnCard) availableCards.push({label:'Turn: '+turnCard.name,area:'turn',index:0});
    if(riverCard) availableCards.push({label:'River: '+riverCard.name,area:'river',index:0});

    if(isAIPlayer()){
        if(!availableCards.length) return null;
        return availableCards[Math.floor(Math.random()*availableCards.length)];
    }

    return new Promise(resolve=>{
        const modal=document.getElementById('targetModal');
        const buttons=document.getElementById('targetButtons');
        buttons.innerHTML='';

        availableCards.forEach(item=>{
            const btn=document.createElement('button');
            btn.className='targetBtn';
            btn.textContent=item.label;
            btn.onclick=()=>{
                modal.style.display='none';
                resolve(item);
            };
            buttons.appendChild(btn);
        });

        modal.style.display='block';
    });
}

function replaceCommunityCard(selection){

    const newCard =
        drawValidCommunityCard();

    if(!newCard){
        alert("No valid replacement card available.");
        return false;
    }

    if(selection.area==="flop"){

        const oldCard =
            flop[selection.index];

        burnPile.push(oldCard);

        flop[selection.index] =
            newCard;

        log("Changed community card: burned " + oldCard.name + " and replaced it with " + newCard.name + ".");

        return true;
    }

    if(selection.area==="turn"){

        const oldCard =
            turnCard;

        burnPile.push(oldCard);

        turnCard =
            newCard;

        log("Changed Turn card: burned " + oldCard.name + " and replaced it with " + newCard.name + ".");

        return true;
    }

    if(selection.area==="river"){

        const oldCard =
            riverCard;

        burnPile.push(oldCard);

        riverCard =
            newCard;

        log("Changed River card: burned " + oldCard.name + " and replaced it with " + newCard.name + ".");

        return true;
    }

    return false;
}

function passHands(direction){

    // Copy all hands and hand-based effects first so the pass happens simultaneously.
    const originalHands =
        players.map(p => p.hand);

    const originalHandEffects =
        players.map(p => ({
            bonus: p.effects.bonus,
            faceUp: p.effects.faceUp
        }));

    const count =
        players.length;

    players.forEach((player,index)=>{

        let sourceIndex;

        if(direction==="left"){

            // Everyone passes to the left.
            // Each player receives from the player on their right.
            sourceIndex =
                (index + 1) % count;

        } else {

            // Everyone passes to the right.
            // Each player receives from the player on their left.
            sourceIndex =
                (index - 1 + count) % count;
        }

        player.hand =
            originalHands[sourceIndex];

        // Hand effects transfer with the hand.
        player.effects.bonus =
            originalHandEffects[sourceIndex].bonus;

        player.effects.faceUp =
            originalHandEffects[sourceIndex].faceUp;

        // Player effects stay with the player.
        // Skip does not transfer.
    });

    if(direction==="left"){

        log(currentPlayer().name+" played Pass Left.");

    } else {

        log(currentPlayer().name+" played Pass Right.");
    }

    return true;
}

function tradeHandsWithPlayer(targetIndex){

    const actingPlayer =
        currentPlayer();

    const targetPlayer =
        players[targetIndex];

    const tempHand =
        actingPlayer.hand;

    actingPlayer.hand =
        targetPlayer.hand;

    targetPlayer.hand =
        tempHand;

    // Hand effects transfer with the hand.
    const actingHandEffects = {
        bonus: actingPlayer.effects.bonus,
        faceUp: actingPlayer.effects.faceUp
    };

    actingPlayer.effects.bonus =
        targetPlayer.effects.bonus;

    actingPlayer.effects.faceUp =
        targetPlayer.effects.faceUp;

    targetPlayer.effects.bonus =
        actingHandEffects.bonus;

    targetPlayer.effects.faceUp =
        actingHandEffects.faceUp;

    // Player effects stay with the player.
    // Skip does not transfer.

    log(actingPlayer.name+" traded hands with "+targetPlayer.name+".");

    return true;
}

function fullResetPlayer(playerIndex){

    const targetPlayer =
        players[playerIndex];

    while(targetPlayer.hand.length>0){

        const burnedCard =
            targetPlayer.hand.pop();

        burnPile.push(burnedCard);
    }

    targetPlayer.effects.bonus = false;
    targetPlayer.effects.faceUp = false;

    for(let i=0;i<2;i++){

        if(deck.length>0){

            targetPlayer.hand.push(deck.pop());
        }
    }

    log(targetPlayer.name+" was fully reset and drew 2 new cards.");

    return true;
}


const MAX_HAND_CARDS = 3;

function canEndTurn(player){
    return !!(player && player.hand && player.hand.length <= MAX_HAND_CARDS);
}

function handLimitMessage(player){
    const name = player ? player.name : "This player";
    const count = player && player.hand ? player.hand.length : 0;
    return name + " has " + count + " cards. Discard until they have " + MAX_HAND_CARDS + " or fewer cards.";
}

function firstLegalDiscardIndexForPlayer(player){
    if(!player || !player.hand) return -1;

    // Prefer normal cards first when simply trimming an oversized hand.
    for(let i=0;i<player.hand.length;i++){
        const c=player.hand[i];
        if(c && c.category!=="action" && c.id!==lastDrawnFromDiscardId){
            return i;
        }
    }

    // Then allow action cards if needed.
    for(let i=0;i<player.hand.length;i++){
        const c=player.hand[i];
        if(c && c.id!==lastDrawnFromDiscardId){
            return i;
        }
    }

    return -1;
}

async function enforceAIHandLimitBeforeTurnEnd(player){
    if(!player || !player.isAI) return false;

    let safety=0;

    while(player.hand.length > MAX_HAND_CARDS && safety < 10){
        const idx=firstLegalDiscardIndexForPlayer(player);

        if(idx<0){
            break;
        }

        const card=player.hand.splice(idx,1)[0];
        discardPile.push(card);
        log("🤖 "+player.name+" discarded "+card.name+" to get back to the 3-card limit.");
        safety++;
    }

    return player.hand.length <= MAX_HAND_CARDS;
}

function hasAnyBonusTarget(excludeSelf=true){
    return players.some((p,i)=>{
        if(excludeSelf && i===currentPlayerIndex) return false;
        return canReceiveBonusCard(i);
    });
}


function applyBonusToPlayer(playerIndex){

    if(!canReceiveBonusCard(playerIndex)){
        alert(getBonusBlockedMessage(playerIndex));
        return false;
    }

    if(deck.length===0){
        alert("Deck Empty. Bonus cannot draw a card.");
        return false;
    }

    const targetPlayer =
        players[playerIndex];

    const bonusCard =
        deck.pop();

    targetPlayer.hand.push(bonusCard);

    targetPlayer.effects.bonus = true;

    log(targetPlayer.name+" received a Bonus Card and drew one extra card.");

    return true;
}



function canReceiveBonusCard(playerIndex){
    const target=players[playerIndex];
    if(!target) return false;
    return (target.hand || []).length < MAX_HAND_CARDS;
}

function getBonusBlockedMessage(playerIndex){
    const target=players[playerIndex];
    const name=target ? target.name : "That player";
    return name + " already has " + MAX_HAND_CARDS + " cards and cannot receive another Bonus Card."; 
}


function canPlayActionCard(card){
if(card.action==="change_community"){
        const communityCount = flop.length + (turnCard ? 1 : 0) + (riverCard ? 1 : 0);
        if(communityCount===0){
            return {valid:false, reason:"No community cards have been revealed yet."};
        }
    }

    if(card.action==="trade_hands"){
        if(players.length < 2){
            return {valid:false, reason:"No valid target available."};
        }
    }

    if(card.action==="bonus_self" || card.action==="bonus_targeted"){
        if(deck.length===0){
            return {valid:false, reason:"Deck is empty."};
        }

        if(card.action==="bonus_self"){
            // During MUST_DISCARD, the Bonus card itself will be removed before resolving.
            const projectedHandSize = Math.max(0,(currentPlayer().hand||[]).length - 1);
            if(projectedHandSize >= MAX_HAND_CARDS){
                return {valid:false, reason:"You already have "+MAX_HAND_CARDS+" cards and cannot receive another Bonus Card."};
            }
        }

        if(card.action==="bonus_targeted" && !hasAnyBonusTarget(true)){
            return {valid:false, reason:"No valid Bonus Card targets. All opponents already have "+MAX_HAND_CARDS+" cards."};
        }
    }

    if(card.action==="burn_targeted"){
        const validTargets = players.filter((p,i)=>i!==currentPlayerIndex && p.hand.length>1);
        if(validTargets.length===0){
            return {valid:false, reason:"No valid burn targets."};
        }
    }

    if(card.action==="burn_all"){
        const validTargets = players.filter((p,i)=>i!==currentPlayerIndex && p.hand.length>1);
        if(validTargets.length===0){
            return {valid:false, reason:"No players can be burned."};
        }
    }

    if(card.action==="peek_targeted" || card.action==="face_up_targeted" || card.action==="skip"){
        if(players.length < 2){
            return {valid:false, reason:"No valid target available."};
        }
    }

    return {valid:true};
}


async function resolveActionCard(card){
    if(card.action==="peek_targeted"){
        const idx=await chooseTarget(true);
        if(idx===null) return false;
        if(!isAIPlayer()){
            alert(players[idx].name+"'s hand: "+players[idx].hand.map(c=>c.name).join(", "));
        }
        rememberAction(currentPlayerIndex,idx,card.action);
        log(currentPlayer().name+" peeked at "+players[idx].name+"'s hand.");
        return true;
    }

    if(card.action==="face_up_targeted"){
        const idx=await chooseTarget(true);
        if(idx===null) return false;
        players[idx].effects.faceUp=true;
        rememberAction(currentPlayerIndex,idx,card.action);
        log(players[idx].name+" must play face up.");
        return true;
    }

    if(card.action==="face_up_self"){
        currentPlayer().effects.faceUp=true;
        log(currentPlayer().name+" must play face up.");
        return true;
    }

    if(card.action==="skip"){
        const idx=await chooseTarget(true);
        if(idx===null) return false;
        addSkipToPlayer(idx);
        rememberAction(currentPlayerIndex,idx,card.action);
        log(players[idx].name+" will lose their next turn.");
        return true;
    }

    if(card.action==="burn_targeted"){
        const validTargets =
            players
            .map((p,i)=>({p,i}))
            .filter(x=>x.i!==currentPlayerIndex && x.p.hand.length>1);

        if(validTargets.length===0){
            alert("No valid burn targets. Players must have at least 2 cards.");
            return false;
        }

        const idx=await chooseTarget(true);

        if(idx===null) return false;

        if(players[idx].hand.length<=1){
            alert(players[idx].name+" only has one card and cannot be burned.");
            return false;
        }

        burnRandomCardFromPlayer(idx);
        rememberAction(currentPlayerIndex,idx,card.action);
        return true;
    }

    if(card.action==="burn_all"){

        let burnedAny=false;

        players.forEach((p,i)=>{
            if(i!==currentPlayerIndex && p.hand.length>1){
                const result=burnRandomCardFromPlayer(i);
                if(result) burnedAny=true;
            }
        });

        if(!burnedAny){
            log("Burn All was played, but no other players had enough cards to burn.");
        } else {
            log(currentPlayer().name+" played Burn All.");
        }

        return true;
    }

    if(card.action==="change_community"){

        const communityCount =
            flop.length +
            (turnCard ? 1 : 0) +
            (riverCard ? 1 : 0);

        if(communityCount===0){

            alert("No community cards have been revealed yet.");
            return false;
        }

        const selection =
            await chooseCommunityCard();

        if(selection===null) return false;

        return replaceCommunityCard(selection);
    }

    if(card.action==="pass_left"){

        return passHands("left");
    }

    if(card.action==="pass_right"){

        return passHands("right");
    }

    if(card.action==="trade_hands"){

        const idx=await chooseTarget(true);

        if(idx===null) return false;

        rememberAction(currentPlayerIndex,idx,card.action);
        return tradeHandsWithPlayer(idx);
    }

    if(card.action==="full_reset_self"){

        return fullResetPlayer(currentPlayerIndex);
    }

    if(card.action==="full_reset_targeted"){

        const idx=await chooseTarget(true);

        if(idx===null) return false;

        rememberAction(currentPlayerIndex,idx,card.action);
        return fullResetPlayer(idx);
    }

    if(card.action==="full_reset_all"){

        players.forEach((p,i)=>{

            if(i!==currentPlayerIndex){

                fullResetPlayer(i);
            }
        });

        log(currentPlayer().name+" played Full Reset All.");

        return true;
    }

    if(card.action==="bonus_self"){

        
        if(!canReceiveBonusCard(currentPlayerIndex)){
            alert(getBonusBlockedMessage(currentPlayerIndex));
            return false;
        }
return applyBonusToPlayer(currentPlayerIndex);
    }

    if(card.action==="bonus_targeted"){

        const idx=await chooseTarget(true);

        if(idx===null) return false;

        if(!canReceiveBonusCard(idx)){
            alert(getBonusBlockedMessage(idx));
            return false;
        }

        rememberAction(currentPlayerIndex,idx,card.action);
        return applyBonusToPlayer(idx);
    }

    alert(card.name+" is not programmed yet. It will be treated as a normal discard for now.");
    log(card.name+" effect is not implemented yet.");
    return true;
}

async function discardCard(index, confirmedAction=false){
    if(handOver){ alert("Hand is over. Start the next hand."); return; }

    if(turnState!=="MUST_DISCARD"){
        alert("You must draw before discarding.");
        return;
    }

    const player=currentPlayer();
    const card=player.hand[index];

    if(!card){
        alert("Card not found.");
        updateAll();
        return;
    }

    if(card.id===lastDrawnFromDiscardId){
        alert("You cannot immediately discard the card you drew from the discard pile.");
        return;
    }

    // IMPORTANT:
    // Action cards must be removed from the acting player's hand BEFORE their effect resolves.
    // Otherwise cards like Trade Hands / Pass Hands can move the hand first, and the game then
    // tries to discard from the wrong hand.
    const discarded=player.hand.splice(index,1)[0];

    if(discarded.category==="action"){

        if(!confirmedAction){
            player.hand.splice(index,0,discarded);
            previewActionCard(index);
            return;
        }

        const validation = canPlayActionCard(discarded);

        if(!validation.valid){
            alert(validation.reason);
            player.hand.splice(index,0,discarded);
            updateAll();
            return;
        }

        const resolved=await resolveActionCard(discarded);

        if(!resolved){
            // If the player cancels target selection or the effect cannot resolve,
            // put the Action Card back where it came from.
            player.hand.splice(index,0,discarded);
            updateAll();
            return;
        }

        await playActionAnimation(discarded, player.name);
        await playUniqueActionAnimation(discarded);
        await playTableMotionAnimation(discarded, player.name);

        if(lastActionPlayerIndex!==currentPlayerIndex){
            rememberAction(currentPlayerIndex,lastActionTargetIndex,discarded.action);
        }

        discardPile.push(discarded);

        log(playerDisplayName(player)+" played Action Card: "+discarded.name+" ("+discarded.target+")");

    } else {

        discardPile.push(discarded);

        log(player.name+" discarded "+discarded.name);
    }

    if(player.hand.length > MAX_HAND_CARDS){
        if(player.isAI){
            await enforceAIHandLimitBeforeTurnEnd(player);
        }

        if(player.hand.length > MAX_HAND_CARDS){
            turnState="MUST_DISCARD";
            lastDrawnFromDiscardId=null;
            alert(handLimitMessage(player));
            log(player.name+" must discard down to "+MAX_HAND_CARDS+" cards before ending the turn.");
            updateAll();
            return;
        }
    }

    turnState="TURN_COMPLETE";
    lastDrawnFromDiscardId=null;

    // Automatically move to the next player's turn after a discard/action card.
    autoAdvanceAfterDiscard();
}

function burnCard(){ if(deck.length===0) return; burnPile.push(deck.pop()); log("Burned one card before street"); }

function drawValidCommunityCard(){
    while(deck.length>0){
        const card=deck.pop();
        if(card.category==="action" || card.category==="wild"){ burnPile.push(card); log("Invalid community card burned: "+card.name); continue; }
        return card;
    }
    return null;
}

function revealFlop(){
    if(handOver){ alert("Hand is over. Start the next hand."); return; }

    if(phase!=="PRE-FLOP" || turnState!=="MUST_DRAW") return;
    burnCard();
    flop=[drawValidCommunityCard(),drawValidCommunityCard(),drawValidCommunityCard()].filter(Boolean);
    phase="FLOP"; turnState="MUST_DRAW"; lastDrawnFromDiscardId=null; currentPlayerIndex=0;
    ensureDiscardTopPlayable();
    log("Flop revealed");
    updateAll();
}

function revealTurn(){
    if(handOver){ alert("Hand is over. Start the next hand."); return; }

    if(phase!=="FLOP" || turnState!=="MUST_DRAW") return;
    burnCard(); turnCard=drawValidCommunityCard();
    phase="TURN"; turnState="MUST_DRAW"; lastDrawnFromDiscardId=null; currentPlayerIndex=0;
    ensureDiscardTopPlayable();
    log("Turn revealed");
    updateAll();
}

function revealRiver(){
    if(handOver){ alert("Hand is over. Start the next hand."); return; }

    if(phase!=="TURN" || turnState!=="MUST_DRAW") return;
    burnCard(); riverCard=drawValidCommunityCard();
    phase="RIVER"; turnState="MUST_DRAW"; lastDrawnFromDiscardId=null; currentPlayerIndex=0;
    ensureDiscardTopPlayable();
    log("River revealed");
    updateAll();
}

function cardHtml(card,clickAction=""){

    const clickableClass =
        clickAction ? "clickable" : "";

    if(card.category==="standard"){

        const suit =
            card.name.slice(-1);

        const rank =
            card.name.slice(0,-1);

        const isRed =
            suit==="♥" || suit==="♦";

        return `
            <div
                class="card pokerCard ${isRed ? "redCard" : "blackCard"} ${clickableClass}"
                ${clickAction}
            >
                <div class="cardCorner topLeft">
                    ${rank}<br>${suit}
                </div>

                <div class="centerSuit">
                    ${suit}
                </div>

                <div class="cardCorner bottomRight">
                    ${rank}<br>${suit}
                </div>
            </div>
        `;
    }

    if(card.category==="wild"){

        let suitDisplay = "♠ ♥<br>♦ ♣";

        if(card.wildSuit){
            suitDisplay = `${card.wildSuit}<br>${card.wildSuit}`;
        }

        return `
            <div class="card wildFace ${clickableClass}" ${clickAction}>
                <div style="font-size:22px;">WILD</div>
                <div class="wildSuitGrid">${suitDisplay}</div>
                <div style="transform:rotate(180deg);font-size:22px;">WILD</div>
            </div>
        `;
    }

    if(card.category==="action"){

        const colorMap = {
            skip:"#075985",
            bonus:"#15803d",
            burn:"#dc0000",
            reset:"#e66a00",
            info:"#6d3279",
            swap:"#f2b600"
        };

        const iconMap = {
            skip:"⊘",
            bonus:"+",
            burn:"🔥",
            reset:"↻",
            info:"1",
            swap:"⇄"
        };

        const targetIcon = {
            targeted:"🎯",
            self:"👤",
            all:"👥"
        };

        const title =
            card.name
                .replace("Change Community","COMM CARD")
                .replace("Trade Hands","TRADE HANDS")
                .replace("Full Reset","FULL RESET")
                .replace("Face Up","FACE UP")
                .replace("Bonus","BONUS CARD")
                .replace("Burn","BURN")
                .replace("Skip","SKIP")
                .replace("Peek","PEEK");

        const textColor =
            card.color==="swap" ? "#111" : "white";

        return `
            <div
                class="card actionFace ${clickableClass}"
                ${clickAction}
                style="background:${colorMap[card.color] || "#444"}; color:${textColor}; position:relative;"
            >
                <div class="targetBadge">
                    ${targetIcon[card.target] || ""}
                </div>

                <div class="actionIcon">
                    ${iconMap[card.color] || "★"}
                </div>

                <div class="actionTitle">
                    ${title}
                </div>

                <div class="actionPenalty">
                    ${card.penalty}
                </div>
            </div>
        `;
    }

    return "";
}

function renderScoreboard(){

    let html="<table><tr><th>Player</th><th>Type</th><th>Score</th><th>Needed</th></tr>";

    players.forEach((player,index)=>{
        const score=gameScores[index] || 0;
        const needed=Math.max(0,targetScore-score);
        html += `
            <tr>
                <td>${aiBadgeHtml(player,true)}</td>
                <td>${player.isAI ? "AI • "+player.personality+" • "+(AI_DIFFICULTY_SETTINGS[player.difficulty]?.label || "Normal") : "Human"}</td>
                <td><strong>${score}</strong></td>
                <td>${needed}</td>
            </tr>
        `;
    });

    html+="</table>";

    document.getElementById("scoreboard").innerHTML=html;
}


function hiddenHandHtml(player){

    let cards = "";

    for(let i=0;i<player.hand.length;i++){

        cards += `
            <div class="card cardBack">
                <div class="backLogo">
                    <div class="backAction">ACTION</div>
                    <div class="backHoldem">HOLD 'EM</div>
                    <div class="cornerClub">♣</div>
                    <div class="cornerHeart">♥</div>
                </div>
            </div>
        `;
    }

    return cards;
}

function renderPlayers(){
    let html="";

    players.forEach((p,i)=>{
        const isCurrent=i===currentPlayerIndex;

        const effectHtml=[
            p.effects.skip ? "<span class='effect'>Skip Pending</span>" : "",
            p.effects.faceUp ? "<span class='effect'>Face Up</span>" : "",
            p.effects.bonus ? "<span class='effect'>Bonus</span>" : ""
        ].join("");

        let cards="";

        if(p.effects.faceUp || handOver){
            cards=p.hand.map(c=>cardHtml(c)).join("");
        }else{
            cards=hiddenHandHtml(p);
        }

        html+=`
            <div class="seat seat-${i} ${isCurrent ? "currentPlayer" : ""}">
                <div class="seatAvatar aiAvatarChip" style="background:${playerColor(p)}">${playerAvatar(p)}</div>${i===dealerIndex?'<div class="dealerButton">D</div>':""}
                <div class="seatHeader">
                    <div>${isCurrent ? "▶ " : ""}${escapeHtml(p.name)}</div>
                    <div class="aiPersonalityTag">${p.isAI ? escapeHtml(p.personality+" • "+(getDifficultySettings(p.difficulty).label || "Normal")) : "Human"}</div>
                    ${p.isAI && aiMemorySummary(p)?`<div class="aiMemoryTag">${escapeHtml(aiMemorySummary(p))}</div>`:""}
                    <div class="seatScore">$${gameScores[i] || 0}</div>
                </div>
                <div class="seatCards">${cards}</div>
                <div class="seatEffects">${effectHtml}</div>
            </div>
        `;
    });

    document.getElementById("players").innerHTML=html;
}






function renderHandPreview(){

    const preview =
        document.getElementById("handPreview");

    if(!preview) return;

    if(!handRevealed || handOver){
        preview.style.display = "none";
        preview.innerHTML = "";
        return;
    }

    const player = currentPlayer();

    const available=[
        ...player.hand,
        ...flop,
        ...(turnCard ? [turnCard] : []),
        ...(riverCard ? [riverCard] : [])
    ];

    let label="High Card";
    let points=-50;

    const rankMap={"2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"10":10,"J":11,"Q":12,"K":13,"A":14};

    const standardCards=available.filter(c=>c.category==="standard");

    if(available.length >= 5){

        const result=evaluatePlayerBestHand(player);

        label=result.label;
        points=result.points;

        var cardsUsed=(result.cardsUsed||[]).join(" ");

    } else if(standardCards.length){

        const ranks=standardCards.map(card=>{
            const rankText=card.name.slice(0,-1);
            return rankMap[rankText];
        });

        const counts={};

        ranks.forEach(r=>{
            counts[r]=(counts[r]||0)+1;
        });

        const pairRank=Object.keys(counts).find(r=>counts[r] >= 2);

        if(pairRank){

            const rankNames={
                "11":"Jacks",
                "12":"Queens",
                "13":"Kings",
                "14":"Aces"
            };

            label="Pair of " + (rankNames[pairRank] || (pairRank + "s"));
            points=-25;

        } else {

            const high=Math.max(...ranks);

            const highNames={
                11:"Jack High",
                12:"Queen High",
                13:"King High",
                14:"Ace High"
            };

            label=highNames[high] || (high + " High");
            points=-50;
        }
    }

    preview.style.display = "block";

    preview.innerHTML = `
        <div style="font-size:14px;opacity:.85;">
            Current Best Hand
        </div>

        <div style="font-size:22px;margin-top:4px;color:#ffd54f;font-weight:900;">
            ${label}
        </div>

        <div style="font-size:18px;margin-top:4px;">
            ${points} Points
        </div>

        <div class="cardUsedLine">${typeof cardsUsed !== 'undefined' && cardsUsed ? "Using: " + cardsUsed : ""}</div>
    `;
}

function renderHand(){

    const revealArea =
        document.getElementById("revealHandArea");

    const player =
        currentPlayer();

    if(!handRevealed && !handOver){

        revealArea.innerHTML = `
            <div class="passScreen">
                <div>Pass Device To</div>

                <div class="passPlayer">
                    ${escapeHtml(player.name)}
                </div>

                <button onclick="revealCurrentHand()">
                    Reveal Hand
                </button>
            </div>
        `;

        document.getElementById("hand").innerHTML = "";
        const preview = document.getElementById("handPreview");
        if(preview){
            preview.style.display = "none";
            preview.innerHTML = "";
        }

        return;
    }

    revealArea.innerHTML = "";

    document.getElementById("hand").innerHTML =
        player.hand.map((c,i)=>{
            let click="";
            if(turnState==="MUST_DISCARD"){
                click = c.category==="action"
                    ? `onclick="previewActionCard(${i})"`
                    : `onclick="discardCard(${i})"`;
            }
            let html=cardHtml(c,click);
            if(turnState==="MUST_DISCARD"){
                html=html.replace('class="card ','class="card legalCard ');
            }
            return html;
        }).join("");
}


function renderDiscard(){
    if(discardPile.length===0){ document.getElementById("discard").innerHTML="Empty"; return; }
    const card=discardPile[discardPile.length-1];
    const canClick=!handOver && turnState==="MUST_DRAW" && card.category!=="action";
    document.getElementById("discard").innerHTML=cardHtml(card, canClick ? `onclick="drawFromDiscard()"` : "");
}

function renderBoard(){
    document.getElementById("flop").innerHTML=flop.map(card=>cardHtml(card)).join("");
    document.getElementById("turn").innerHTML=turnCard ? cardHtml(turnCard) : "";
    document.getElementById("river").innerHTML=riverCard ? cardHtml(riverCard) : "";
}


function parseStandardCard(card){
    const name = card.name;
    const suit = name.slice(-1);
    const rankText = name.slice(0,-1);
    const rankMap = {"2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"10":10,"J":11,"Q":12,"K":13,"A":14};
    return {
        rank: rankMap[rankText],
        suit: suit,
        name: name
    };
}

function getAllStandardCardPossibilities(){
    const suits=["♠","♥","♦","♣"];
    const ranks=[
        {t:"2",v:2},{t:"3",v:3},{t:"4",v:4},{t:"5",v:5},{t:"6",v:6},{t:"7",v:7},
        {t:"8",v:8},{t:"9",v:9},{t:"10",v:10},{t:"J",v:11},{t:"Q",v:12},{t:"K",v:13},{t:"A",v:14}
    ];

    const cards=[];
    for(const suit of suits){
        for(const rank of ranks){
            cards.push({rank:rank.v,suit:suit,name:rank.t+suit});
        }
    }
    return cards;
}

function combinations(array, size){
    const result=[];
    function backtrack(start, combo){
        if(combo.length===size){
            result.push([...combo]);
            return;
        }
        for(let i=start;i<array.length;i++){
            combo.push(array[i]);
            backtrack(i+1, combo);
            combo.pop();
        }
    }
    backtrack(0, []);
    return result;
}

function compareRankArrays(a,b){
    const len=Math.max(a.length,b.length);
    for(let i=0;i<len;i++){
        const av=a[i] || 0;
        const bv=b[i] || 0;
        if(av!==bv) return av-bv;
    }
    return 0;
}

function compareEvaluations(a,b){
    if(!b) return 1;
    if(a.points!==b.points) return a.points-b.points;
    return compareRankArrays(a.tie,b.tie);
}

function straightHighFromRanks(ranks){
    const unique=[...new Set(ranks)].sort((a,b)=>a-b);

    if(unique.includes(14)){
        unique.unshift(1);
    }

    let best=0;
    for(let i=0;i<=unique.length-5;i++){
        const run=unique.slice(i,i+5);
        if(run[4]-run[0]===4 && new Set(run).size===5){
            best=Math.max(best, run[4]===1 ? 5 : run[4]);
        }
    }
    
    return best;
}

function evaluateConcreteFive(cards, usedWild){
    const ranks=cards.map(c=>c.rank).sort((a,b)=>b-a);
    const suits=cards.map(c=>c.suit);
    const flush=suits.every(s=>s===suits[0]);
    const straightHigh=straightHighFromRanks(ranks);

    const counts={};
    ranks.forEach(r=>counts[r]=(counts[r]||0)+1);

    const groups=Object.keys(counts)
        .map(r=>({rank:parseInt(r), count:counts[r]}))
        .sort((a,b)=>{
            if(b.count!==a.count) return b.count-a.count;
            return b.rank-a.rank;
        });

    const isRoyal =
        flush &&
        straightHigh===14 &&
        [10,11,12,13,14].every(r=>ranks.includes(r));

    const natural = !usedWild;

    if(isRoyal){
        return {
            label:natural ? "Natural Royal Flush" : "Royal Flush",
            points:natural ? 500 : 350,
            tie:[14],
            cardsUsed: cards.map(c=>c.name)
        };
    }

    if(flush && straightHigh){
        return {
            label:natural ? "Natural Straight Flush" : "Straight Flush",
            points:natural ? 300 : 225,
            tie:[straightHigh],
            cardsUsed: cards.map(c=>c.name)
        };
    }

    if(groups[0].count===4){
        const fourRank=groups[0].rank;
        const kicker=groups.find(g=>g.count===1)?.rank || 0;
        return {
            label:natural ? "Natural Four of a Kind" : "Four of a Kind",
            points:natural ? 200 : 150,
            tie:[fourRank,kicker],
            cardsUsed: cards.map(c=>c.name)
        };
    }

    if(groups[0].count===3 && groups[1] && groups[1].count===2){
        return {
            label:"Full House",
            points:125,
            tie:[groups[0].rank, groups[1].rank],
            cardsUsed: cards.map(c=>c.name)
        };
    }

    if(flush){
        return {
            label:"Flush",
            points:100,
            tie:ranks,
            cardsUsed: cards.map(c=>c.name)
        };
    }

    if(straightHigh){
        return {
            label:"Straight",
            points:80,
            tie:[straightHigh],
            cardsUsed: cards.map(c=>c.name)
        };
    }

    if(groups[0].count===3){
        const kickers=groups.filter(g=>g.count===1).map(g=>g.rank).sort((a,b)=>b-a);
        return {
            label:"Three of a Kind",
            points:40,
            tie:[groups[0].rank,...kickers],
            cardsUsed: cards.map(c=>c.name)
        };
    }

    if(groups[0].count===2 && groups[1] && groups[1].count===2){
        const pairs=groups.filter(g=>g.count===2).map(g=>g.rank).sort((a,b)=>b-a);
        const kicker=groups.find(g=>g.count===1)?.rank || 0;
        return {
            label:"Two Pair",
            points:30,
            tie:[...pairs,kicker],
            cardsUsed: cards.map(c=>c.name)
        };
    }

    if(groups[0].count===2){
        const pair=groups[0].rank;
        const kickers=groups.filter(g=>g.count===1).map(g=>g.rank).sort((a,b)=>b-a);
        return {
            label:"One Pair",
            points:-25,
            tie:[pair,...kickers],
            cardsUsed: cards.map(c=>c.name)
        };
    }

    return {
        label:"High Card",
        points:-50,
        tie:ranks
    };
}

function expandAndEvaluateFive(combo){
    const wilds=combo.filter(c=>c.category==="wild");
    const naturals=combo.filter(c=>c.category!=="wild").map(parseStandardCard);

    if(wilds.length===4){
        return {
            label:"Four of a Kind (All Wild Cards)",
            points:200,
            tie:[14],
            cardsUsed: cards.map(c=>c.name)
        };
    }

    if(wilds.length===0){
        return evaluateConcreteFive(naturals, false);
    }

    if(wilds.length>3){
        return null;
    }

    const allCards=getAllStandardCardPossibilities();
    const usedNames=new Set(naturals.map(c=>c.name));
    let best=null;

    function recurse(wildIndex, assigned){
        if(wildIndex===wilds.length){
            const evalResult=evaluateConcreteFive([...naturals,...assigned], true);
            if(compareEvaluations(evalResult,best)>0){
                best=evalResult;
            }
            return;
        }

        const wild=wilds[wildIndex];

        for(const possible of allCards){
            if(usedNames.has(possible.name)) continue;

            if(wild.wildSuit && wild.wildSuit!==possible.suit) continue;

            usedNames.add(possible.name);
            assigned.push(possible);
            recurse(wildIndex+1, assigned);
            assigned.pop();
            usedNames.delete(possible.name);
        }
    }

    recurse(0,[]);
    return best;
}

function evaluatePlayerBestHand(player){
    const available=[
        ...player.hand,
        ...flop,
        ...(turnCard ? [turnCard] : []),
        ...(riverCard ? [riverCard] : [])
    ];

    const fiveCardCombos=combinations(available,5);
    let best=null;
    let bestCombo=null;

    for(const combo of fiveCardCombos){
        const evalResult=expandAndEvaluateFive(combo);
        if(evalResult && compareEvaluations(evalResult,best)>0){
            best=evalResult;
            bestCombo=combo;
        }
    }

    if(!best){
        return {
            label:"Waiting For Community Cards",
            points:0,
            tie:[]
        };
    }

    return best;
}

function actionPenaltyForPlayer(player){
    return player.hand
        .filter(card=>card.category==="action")
        .reduce((sum,card)=>sum+card.penalty,0);
}


function showMVPModal(title, hand, points){
    const body=document.getElementById("mvpBody");
    body.innerHTML=`
        <h2>${escapeHtml(title)}</h2>
        <h3 style="color:#d4af37;">${escapeHtml(hand)}</h3>
        <h2>${points} Points</h2>
    `;
    document.getElementById("mvpModal").style.display="block";
    setTimeout(()=>{
        document.getElementById("mvpModal").style.display="none";
    },2500);
}


function showdown(){
    log("Showdown function started.");

    if(phase!=="RIVER"){
        alert("Reveal the river before showdown.");
        return;
    }

    if(handAlreadyScored){
        alert("This hand has already been scored. Start a new hand.");
        return;
    }

    const expertToggle =
        document.getElementById("expertModeToggle");

    const expertMode =
        expertToggle ? expertToggle.checked : false;

    const results=players.map((player, playerIndex)=>{
        const handEval=evaluatePlayerBestHand(player);
        const penalty=actionPenaltyForPlayer(player);
        return {
            player:player,
            playerIndex:playerIndex,
            handEval:handEval,
            penalty:penalty,
            bestBonus:0,
            handPoints:handEval.points,
            total:handEval.points + penalty
        };
    });

    let bestResult=null;
    results.forEach(result=>{
        if(compareEvaluations(result.handEval, bestResult ? bestResult.handEval : null)>0){
            bestResult=result;
        }
    });

    const tiedBest=results.filter(result=>compareEvaluations(result.handEval,bestResult.handEval)===0);

    
    const mvpNames=tiedBest.map(r=>r.player.name).join(", ");
    showMVPModal(mvpNames,bestResult.handEval.label,bestResult.handEval.points);

    if(expertMode){


        results.forEach(result=>{
            result.handPoints=0;
            result.bestBonus=0;
            result.total=result.penalty;
        });

        const splitPoints =
            bestResult.handEval.points / tiedBest.length;

        tiedBest.forEach(result=>{
            result.handPoints=splitPoints;
            result.total=splitPoints + result.penalty;
        });

        log("Expert Mode scoring applied.");

    } else {

        if(tiedBest.length<4){
            const bonus=30/tiedBest.length;
            tiedBest.forEach(result=>{
                result.bestBonus=bonus;
                result.total+=bonus;
            });
        }
    }

    results.forEach(result=>{
        gameScores[result.playerIndex] += result.total;
    });

    gameStats.showdowns++;

    results.forEach(result=>{
        if(result.handEval.points > gameStats.bestHandPoints){
            gameStats.bestHandPoints = result.handEval.points;
            gameStats.bestHand = result.handEval.label;
        }
        if(result.total > gameStats.highestSingleHandScore){
            gameStats.highestSingleHandScore = result.total;
        }
    });

    handAlreadyScored=true;
    handOver=true;

    let winnerMessage="";

    const playersAtTarget =
        gameScores.filter(score=>score>=targetScore).length;

    if(playersAtTarget>0 && !finalHandTriggered){

        finalHandTriggered=true;

        winnerMessage =
            "<p><strong>⚠ FINAL HAND ACTIVE</strong><br>A player has reached the target score. Finish this hand to determine the winner.</p>";

        log("Final hand triggered.");
    }

    else if(finalHandTriggered){

        const standings =
            gameScores
                .map((score,index)=>({score,index}))
                .sort((a,b)=>b.score-a.score);

        const winningScore =
            standings[0].score;

        const winners =
            standings.filter(x=>x.score===winningScore);

        winnerMessage =
            "<h2>🏆 GAME OVER</h2>" +
            "<h3>" +
            winners.map(w=>escapeHtml(players[w.index].name)).join(", ") +
            "</h3>" +
            "<p>" + winningScore + " Points</p>" +
            "<h3>Final Standings</h3><ol>" +
            standings.map(s=>
                "<li>" +
                escapeHtml(players[s.index].name) +
                " — " +
                s.score +
                "</li>"
            ).join("") +
            "</ol>";

        showGameOverModal(winnerMessage);
        handOver=true;
    }

    const modeLabel =
        expertMode ? "Expert Mode — Winner Takes Points" : "Standard Mode";

    let html=winnerMessage + "<p><strong>Scoring Mode: " + modeLabel + "</strong></p>" +
        "<table><tr><th>Player</th><th>Best Hand</th><th>Hand Points</th><th>Best Hand Bonus</th><th>Action Penalties</th><th>Hand Total</th><th>Game Score</th></tr>";

    results.forEach(result=>{

        const isWinningHand =
            tiedBest.includes(result);

        html+=`
            <tr style="${isWinningHand ? 'background:linear-gradient(#ffe082,#ffd54f);color:black;font-weight:bold;' : ''}">
                <td>${escapeHtml(result.player.name)}</td>
                <td>${escapeHtml(result.handEval.label)}<br><small>${escapeHtml((result.handEval.cardsUsed||[]).join(" "))}</small></td>
                <td>${result.handPoints}</td>
                <td>${result.bestBonus}</td>
                <td>${result.penalty}</td>
                <td><strong>${result.total}</strong></td>
                <td><strong>${gameScores[result.playerIndex]}</strong></td>
            </tr>
        `;
    });

    html+="</table>";

    document.getElementById("results").innerHTML=html;
    showHandCompleteModal();

    players.forEach(player=>player.effects.faceUp=true);

    log("Showdown scored. Results table updated.");
    updateAll();
}


function updateButtons(){

    const drawBtn=document.getElementById("drawBtn");
    const drawDiscardBtn=document.getElementById("drawDiscardBtn");
    const nextHandBtn=document.getElementById("nextHandBtn");

    const drawDeckReason=document.getElementById("drawDeckReason");
    const drawDiscardReason=document.getElementById("drawDiscardReason");
    const nextHandReason=document.getElementById("nextHandReason");

    const topDiscard=discardPile.length ? discardPile[discardPile.length-1] : null;

    if(drawBtn){
        const disabled=handOver || turnState!=="MUST_DRAW" || deck.length===0 || !handRevealed;
        drawBtn.disabled=disabled;
        if(drawDeckReason){
            drawDeckReason.innerText = !handRevealed ? "Reveal hand first." :
                handOver ? "Hand is over." :
                turnState!=="MUST_DRAW" ? "Must discard before drawing again." :
                deck.length===0 ? "Deck is empty." : "";
        }
    }

    if(drawDiscardBtn){
        const disabled=handOver || turnState!=="MUST_DRAW" || !topDiscard || topDiscard.category==="action" || !handRevealed;
        drawDiscardBtn.disabled=disabled;
        if(drawDiscardReason){
            drawDiscardReason.innerText = !handRevealed ? "Reveal hand first." :
                handOver ? "Hand is over." :
                turnState!=="MUST_DRAW" ? "Must discard before drawing again." :
                !topDiscard ? "Discard pile is empty." :
                topDiscard.category==="action" ? "Action Cards cannot be drawn from discard." : "";
        }
    }

    if(nextHandBtn){
        nextHandBtn.disabled=!handOver && !handAlreadyScored;
        if(nextHandReason){
            nextHandReason.innerText = nextHandBtn.disabled ? "Available after scoring." : "";
        }
    }
}


function renderStats(){
    const statsEl = document.getElementById("stats");
    if(!statsEl){
        return;
    }
    document.getElementById("stats").innerHTML=`
    <table>
        <tr><td>Hands Played</td><td><strong>${gameStats.handsPlayed}</strong></td></tr>
        <tr><td>Showdowns</td><td><strong>${gameStats.showdowns}</strong></td></tr>
        <tr><td>Best Hand Seen</td><td><strong>${gameStats.bestHand}</strong></td></tr>
        <tr><td>Best Hand Points</td><td><strong>${gameStats.bestHandPoints}</strong></td></tr>
        <tr><td>Highest Single Hand Score</td><td><strong>${gameStats.highestSingleHandScore}</strong></td></tr>
    </table>`;
}



function updateTurnGuide(){

    const phaseEl=document.getElementById("guidePhase");
    const actionEl=document.getElementById("guideAction");
    const guide=document.getElementById("turnGuide");

    if(!phaseEl || !actionEl) return;

    if(guide) guide.classList.add("uxCurrentTask");

    if(handOver){
        phaseEl.innerHTML="<div class='uxTaskTitle'>HAND COMPLETE</div>";
        actionEl.innerHTML="<div class='uxTaskAction'>START NEXT HAND</div><div class='uxTaskSub'>Review the results, then start the next hand.</div>";
        return;
    }

    phaseEl.innerHTML="<div class='uxTaskTitle'>YOUR TURN</div><div style='font-size:18px;font-weight:900;margin-top:4px;'>"+escapeHtml(phase+" • "+currentPlayer().name)+"</div>";

    if(currentPlayer() && currentPlayer().hand && currentPlayer().hand.length > MAX_HAND_CARDS){
        actionEl.innerHTML="<div class='handLimitWarning'>⚠️ TOO MANY CARDS<br>Discard until you have "+MAX_HAND_CARDS+" cards.</div>";
    }else{
        actionEl.innerHTML="<div class='uxTaskAction'>"+getNextStepText().toUpperCase()+"</div><div class='uxTaskSub'>"+getWhatHappensNextText()+"</div>";
    }
}



function shouldRevealPlayerHand(playerIndex, player){
    if(handOver) return true;

    if(player && player.effects && player.effects.faceUp){
        return true;
    }

    if(humanPlayerCount===1){
        return !player.isAI && playerIndex===currentPlayerIndex;
    }

    return handRevealed && !player.isAI && playerIndex===currentPlayerIndex;
}

function updateAll(){
    if(humanPlayerCount===1 && currentPlayer() && !currentPlayer().isAI){
        handRevealed=true;
    }
    updateRevealButtonVisibility();
    renderScoreboard();
    renderPlayers();
    renderHand();
    renderHandPreview();
    renderDiscard();
    renderBoard();
    updateButtons();
    updateTurnGuide();
    // Statistics panel removed
    renderRecentActions();

    const phaseEl=document.getElementById("phase");
    if(phaseEl) phaseEl.innerText=phase;

    const turnStateEl=document.getElementById("turnState");
    if(turnStateEl) turnStateEl.innerText=handOver ? "HAND OVER — Start Next Hand" : turnState+" — "+currentPlayer().name;

    const deckCountEl=document.getElementById("deckCount");
    if(deckCountEl) deckCountEl.innerText=deck.length;

    const burnCountEl=document.getElementById("burnCount");
    if(burnCountEl) burnCountEl.innerText=burnPile.length;

    const discardCountEl=document.getElementById("discardCount");
    if(discardCountEl) discardCountEl.innerText=discardPile.length;
}
renderPlayerNameInputs();
// Game starts from the starter screen.


function playCardFlipSound(){
  if(window.AudioManager) AudioManager.play('flip', {volume:0.5});
}

function playShuffleSound(){
  if(window.AudioManager) AudioManager.play('shuffle', {volume:0.4});
}

window.addEventListener('DOMContentLoaded',()=>{ updateStartPlayerSetup(); });
