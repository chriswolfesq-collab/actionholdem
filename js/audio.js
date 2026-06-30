/*
  Audio Manager v2
  Centralized audio playback for Action Hold 'Em.
*/
(function(){
    const SOUND_BASE = "assets/sounds/";

    const categories = {
        ambience: [
            { file: "poker-room.mp3", volume: 0.14, loop: true }
        ],
        draw: [
            { file: "taking-card-2.mp3", volume: 0.46 },
            { file: "taking-card-3.mp3", volume: 0.46 }
        ],
        drawDeck: [
            { file: "taking-card-2.mp3", volume: 0.46 },
            { file: "taking-card-3.mp3", volume: 0.44 }
        ],
        drawDiscard: [
            { file: "taking-card-3.mp3", volume: 0.48 },
            { file: "taking-card-2.mp3", volume: 0.42 }
        ],
        discard: [
            { file: "card-drop.mp3", volume: 0.50 },
            { file: "placing-card.mp3", volume: 0.42 }
        ],
        action: [
            { file: "cards-thrown.mp3", volume: 0.68 },
            { file: "card-drop.mp3", volume: 0.56 }
        ],
        shuffle: [
            { file: "shuffling-deck.mp3", volume: 0.55 },
            { file: "shuffling-cards-01.mp3", volume: 0.52 },
            { file: "shuffle-cards.mp3", volume: 0.50 }
        ],
        flip: [
            { file: "shuffle-and-card-flip.mp3", volume: 0.45 },
            { file: "placing-card.mp3", volume: 0.36 }
        ],
        place: [
            { file: "placing-card.mp3", volume: 0.42 },
            { file: "card-drop.mp3", volume: 0.36 }
        ],
        street: [
            { file: "shuffle-and-card-flip.mp3", volume: 0.48 },
            { file: "shuffle-cards.mp3", volume: 0.44 }
        ],
        deal: [
            { file: "placing-card.mp3", volume: 0.38 },
            { file: "taking-card-2.mp3", volume: 0.32 }
        ],
        burn: [
            { file: "cards-thrown.mp3", volume: 0.64 }
        ],
        trade: [
            { file: "cards-thrown.mp3", volume: 0.60 },
            { file: "shuffle-cards.mp3", volume: 0.48 }
        ]
    };

    const state = {
        ambienceEnabled: true,
        sfxEnabled: true,
        masterVolume: 1,
        ambienceVolume: 1,
        sfxVolume: 1,
        lastPlayedAt: {},
        lastIndex: {},
        loaded: {},
        currentAmbience: null,
        defaultCooldown: 90
    };

    function normalizeClip(clip){
        if(typeof clip === "string") return { file: clip, volume: 1 };
        return clip;
    }

    function getAudioForClip(clip){
        clip = normalizeClip(clip);
        const key = clip.file;
        if(!state.loaded[key]){
            const audio = new Audio(SOUND_BASE + clip.file);
            audio.preload = "auto";
            audio.loop = !!clip.loop;
            state.loaded[key] = audio;
        }
        return state.loaded[key];
    }

    function chooseClip(category){
        const list = categories[category];
        if(!list || !list.length) return null;

        if(list.length === 1){
            state.lastIndex[category] = 0;
            return normalizeClip(list[0]);
        }

        let idx = Math.floor(Math.random() * list.length);

        // Avoid repeating the same sound back-to-back when possible.
        if(idx === state.lastIndex[category]){
            idx = (idx + 1) % list.length;
        }

        state.lastIndex[category] = idx;
        return normalizeClip(list[idx]);
    }

    function canPlay(category, cooldown){
        const now = performance.now();
        const last = state.lastPlayedAt[category] || 0;
        const wait = cooldown ?? state.defaultCooldown;
        if(now - last < wait) return false;
        state.lastPlayedAt[category] = now;
        return true;
    }

    function play(category, options={}){
        if(category === "ambience"){
            return startAmbience(options);
        }

        if(!state.sfxEnabled) return null;
        if(!canPlay(category, options.cooldown)) return null;

        const clip = chooseClip(category);
        if(!clip) return null;

        const audio = getAudioForClip(clip);

        try{
            audio.pause();
            audio.currentTime = 0;
            audio.loop = !!clip.loop;
            audio.volume = Math.max(0, Math.min(1,
                (options.volume ?? clip.volume ?? 1) *
                state.sfxVolume *
                state.masterVolume
            ));
            audio.play().catch(()=>{});
            return audio;
        }catch(e){
            return null;
        }
    }

    function startAmbience(options={}){
        if(!state.ambienceEnabled) return null;

        const clip = chooseClip("ambience");
        if(!clip) return null;

        const audio = getAudioForClip({...clip, loop:true});
        state.currentAmbience = audio;

        try{
            audio.loop = true;
            audio.volume = Math.max(0, Math.min(1,
                (options.volume ?? clip.volume ?? 0.14) *
                state.ambienceVolume *
                state.masterVolume
            ));
            audio.play().catch(()=>{});
            return audio;
        }catch(e){
            return null;
        }
    }

    function stopAmbience(){
        if(state.currentAmbience){
            state.currentAmbience.pause();
        }
    }

    function setAmbienceEnabled(enabled){
        state.ambienceEnabled = !!enabled;
        if(state.ambienceEnabled){
            startAmbience();
        }else{
            stopAmbience();
        }
    }

    function setSfxEnabled(enabled){
        state.sfxEnabled = !!enabled;
    }

    function isAmbienceEnabled(){
        return state.ambienceEnabled;
    }

    function isSfxEnabled(){
        return state.sfxEnabled;
    }

    function setVolume(type, value){
        const v = Math.max(0, Math.min(1, Number(value)));
        if(type === "master") state.masterVolume = v;
        if(type === "ambience") state.ambienceVolume = v;
        if(type === "sfx") state.sfxVolume = v;

        if(state.currentAmbience){
            const clip = chooseClip("ambience");
            state.currentAmbience.volume = Math.max(0, Math.min(1,
                (clip?.volume ?? 0.14) * state.ambienceVolume * state.masterVolume
            ));
        }
    }

    function register(category, clips){
        categories[category] = Array.isArray(clips) ? clips : [clips];
    }

    window.AudioManager = {
        play,
        startAmbience,
        stopAmbience,
        setAmbienceEnabled,
        setSfxEnabled,
        isAmbienceEnabled,
        isSfxEnabled,
        setVolume,
        register,
        categories,
        state
    };
})();
