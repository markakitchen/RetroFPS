const AudioContext = window.AudioContext || window.webkitAudioContext;
let actx, noiseBuffer;

export const Sound = {
    init: () => {
        if(!actx) {
            actx = new AudioContext();
            const bufferSize = actx.sampleRate * 3; 
            noiseBuffer = actx.createBuffer(1, bufferSize, actx.sampleRate);
            const data = noiseBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
            Sound.startAmbience();
        }
        if(actx.state === 'suspended') actx.resume();
    },
    startAmbience: () => {
        const osc = actx.createOscillator(); const gain = actx.createGain();
        const filter = actx.createBiquadFilter();
        osc.type = 'sawtooth'; osc.frequency.value = 40; 
        filter.type = 'lowpass'; filter.frequency.value = 120; 
        const lfo = actx.createOscillator(); lfo.frequency.value = 0.1; 
        const lfoGain = actx.createGain(); lfoGain.gain.value = 50; 
        lfo.connect(lfoGain); lfoGain.connect(filter.frequency);
        osc.connect(filter); filter.connect(gain); gain.connect(actx.destination);
        gain.gain.value = 0.05; osc.start(); lfo.start();
    },
    triggerNoise: (dur, vol, filterFreq, q=1) => {
        if(!actx) return;
        const src = actx.createBufferSource(); src.buffer = noiseBuffer;
        const gain = actx.createGain(); const filter = actx.createBiquadFilter();
        filter.type = 'lowpass'; filter.frequency.setValueAtTime(filterFreq, actx.currentTime); filter.Q.value = q;
        gain.gain.setValueAtTime(vol, actx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, actx.currentTime + dur);
        src.connect(filter); filter.connect(gain); gain.connect(actx.destination);
        src.start(); src.stop(actx.currentTime + dur);
    },
    triggerTone: (freq, type, dur, vol, slideFreq=null) => {
        if(!actx) return;
        const osc = actx.createOscillator(); const gain = actx.createGain();
        osc.type = type; osc.frequency.setValueAtTime(freq, actx.currentTime);
        if(slideFreq) osc.frequency.exponentialRampToValueAtTime(slideFreq, actx.currentTime + dur);
        gain.gain.setValueAtTime(vol, actx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, actx.currentTime + dur);
        osc.connect(gain); gain.connect(actx.destination);
        osc.start(); osc.stop(actx.currentTime + dur);
    },
    shoot: (type, pitchMod = 1.0) => {
        if(!actx) return;
        // PitchMod: < 1.0 = Deeper/Slower, > 1.0 = Higher/Faster
        if(type === 'bullet') { 
            Sound.triggerNoise(0.1, 0.2, 3000 * pitchMod); 
            Sound.triggerTone(800 * pitchMod, 'square', 0.1, 0.1, 100); 
        }
        else if(type === 'spread') { 
            Sound.triggerTone(60 * pitchMod, 'sine', 0.4, 0.5, 10); 
            Sound.triggerNoise(0.3, 0.5, 1000 * pitchMod); 
            Sound.triggerNoise(0.1, 0.3, 5000); 
        }
        else if(type === 'chaingun') { 
            Sound.triggerNoise(0.08, 0.3, 2500 * pitchMod); 
            Sound.triggerTone(300 * pitchMod, 'sawtooth', 0.05, 0.1, 50); 
        }
        else if(type === 'rocket') { 
            Sound.triggerTone(150 * pitchMod, 'triangle', 0.5, 0.4, 50); 
        }
        else if(type === 'bfg') { 
            Sound.triggerTone(50 * pitchMod, 'sawtooth', 1.2, 0.5, 800); 
        }
    },
    explode: () => {
        Sound.triggerNoise(0.8, 0.8, 800); Sound.triggerTone(80, 'triangle', 1.0, 0.6, 10);
    },
    hit: () => {
        Sound.triggerNoise(0.1, 0.1, 3000); Sound.triggerTone(150, 'sawtooth', 0.05, 0.1, 50);
    },
    noAmmo: () => Sound.triggerTone(150, 'square', 0.05, 0.1),
    pickup: () => Sound.triggerTone(1000, 'sine', 0.3, 0.2, 2000),
    powerup: () => {
        // Celestial rising tone
        Sound.triggerTone(400, 'sine', 1.5, 0.3, 1200);
        Sound.triggerTone(402, 'sine', 1.5, 0.3, 1205); // Detuned for chorus effect
    },
    warp: () => { Sound.triggerTone(100, 'sine', 2.0, 0.5, 800); Sound.triggerNoise(2.0, 0.5, 2000); }
};