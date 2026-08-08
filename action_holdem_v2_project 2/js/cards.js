(function(){
    const SUITS = ["♠","♥","♦","♣"];
    const RANKS = ["A","K","Q","J","10","9","8","7","6","5","4","3","2"];

    const ACTION_GROUPS = [
        { count: 4, card: { name:"Skip", category:"action", action:"skip", target:"targeted", penalty:-20, color:"skip" } },
        { count: 3, card: { name:"Trade Hands", category:"action", action:"trade_hands", target:"targeted", penalty:-40, color:"swap" } },
        { count: 1, card: { name:"Pass Left", category:"action", action:"pass_left", target:"all", penalty:-40, color:"swap" } },
        { count: 1, card: { name:"Pass Right", category:"action", action:"pass_right", target:"all", penalty:-40, color:"swap" } },
        { count: 2, card: { name:"Burn", category:"action", action:"burn_targeted", target:"targeted", penalty:-30, color:"burn" } },
        { count: 1, card: { name:"Burn", category:"action", action:"burn_all", target:"all", penalty:-40, color:"burn" } },
        { count: 2, card: { name:"Full Reset", category:"action", action:"full_reset_targeted", target:"targeted", penalty:-50, color:"reset" } },
        { count: 2, card: { name:"Full Reset", category:"action", action:"full_reset_self", target:"self", penalty:-50, color:"reset" } },
        { count: 1, card: { name:"Full Reset", category:"action", action:"full_reset_all", target:"all", penalty:-75, color:"reset" } },
        { count: 2, card: { name:"Bonus", category:"action", action:"bonus_targeted", target:"targeted", penalty:-75, color:"bonus" } },
        { count: 2, card: { name:"Bonus", category:"action", action:"bonus_self", target:"self", penalty:-30, color:"bonus" } },
        { count: 2, card: { name:"Change Community", category:"action", action:"change_community", target:"targeted", penalty:-75, color:"reset" } },
        { count: 1, card: { name:"Face Up", category:"action", action:"face_up_targeted", target:"targeted", penalty:-50, color:"info" } },
        { count: 1, card: { name:"Face Up", category:"action", action:"face_up_self", target:"self", penalty:-75, color:"info" } },
        { count: 2, card: { name:"Peek", category:"action", action:"peek_targeted", target:"targeted", penalty:-40, color:"info" } }
    ];

    function addCopies(deck, createCard, count, card){
        for(let i=0;i<count;i++){
            deck.push(createCard(card));
        }
    }

    function createDeckCards(createCard){
        const deck = [];

        SUITS.forEach(suit=>{
            RANKS.forEach(rank=>{
                deck.push(createCard({ name:rank+suit, category:"standard", type:"standard" }));
            });
        });

        addCopies(deck, createCard, 2, { name:"True Wild", category:"wild", type:"wild" });

        SUITS.forEach(suit=>{
            addCopies(deck, createCard, 2, { name:suit+" Wild", category:"wild", type:"wild", wildSuit:suit });
        });

        ACTION_GROUPS.forEach(group=>{
            addCopies(deck, createCard, group.count, group.card);
        });

        return deck;
    }

    window.ActionHoldemCards = {
        createDeckCards,
        SUITS,
        RANKS,
        ACTION_GROUPS
    };
})();
