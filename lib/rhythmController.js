import { EventEmitter } from 'events';

export class RhythmController extends EventEmitter {
  constructor(lights = []) {
    super();
    this.lights = lights;
    this.isActive = false;
    this.currentEffect = null;
    this.bpm = 120;
    this.beatInterval = null;
    this.effectInterval = null;
    this.colorPalette = [
      { r: 255, g: 0, b: 0 },    // Red
      { r: 0, g: 255, b: 0 },    // Green
      { r: 0, g: 0, b: 255 },    // Blue
      { r: 255, g: 255, b: 0 },  // Yellow
      { r: 255, g: 0, b: 255 },  // Magenta
      { r: 0, g: 255, b: 255 },  // Cyan
      { r: 255, g: 165, b: 0 },  // Orange
      { r: 128, g: 0, b: 128 }   // Purple
    ];
  }

  addLight(light) {
    this.lights.push(light);
  }

  removeLight(lightIp) {
    this.lights = this.lights.filter(light => light.ip !== lightIp);
  }

  setBpm(bpm) {
    this.bpm = Math.max(60, Math.min(200, bpm)); // Limit BPM between 60-200
    if (this.isActive) {
      this.restart();
    }
  }

  setColorPalette(colors) {
    this.colorPalette = colors;
  }

  async startEffect(effectName, options = {}) {
    if (this.isActive) {
      await this.stop();
    }

    this.currentEffect = effectName;
    this.isActive = true;

    const beatDuration = (60 / this.bpm) * 1000; // milliseconds per beat

    switch (effectName) {
      case 'pulse':
        this.beatInterval = setInterval(() => this.pulseEffect(options), beatDuration);
        break;
      
      case 'rainbow':
        this.effectInterval = setInterval(() => this.rainbowEffect(options), beatDuration / 4);
        break;
      
      case 'strobe':
        this.beatInterval = setInterval(() => this.strobeEffect(options), beatDuration / 2);
        break;
      
      case 'wave':
        this.effectInterval = setInterval(() => this.waveEffect(options), beatDuration / 8);
        break;
      
      case 'beat':
        this.beatInterval = setInterval(() => this.beatEffect(options), beatDuration);
        break;
      
      case 'breathe':
        this.effectInterval = setInterval(() => this.breatheEffect(options), beatDuration * 2);
        break;
      
      default:
        throw new Error(`Unknown effect: ${effectName}`);
    }

    this.emit('effectStarted', { effect: effectName, bpm: this.bpm, options });
  }

  async stop() {
    this.isActive = false;
    
    if (this.beatInterval) {
      clearInterval(this.beatInterval);
      this.beatInterval = null;
    }
    
    if (this.effectInterval) {
      clearInterval(this.effectInterval);
      this.effectInterval = null;
    }

    // Turn off all lights
    await Promise.all(this.lights.map(light => light.turnOff()));
    
    this.emit('effectStopped', { effect: this.currentEffect });
    this.currentEffect = null;
  }

  async restart() {
    if (this.isActive && this.currentEffect) {
      const effect = this.currentEffect;
      await this.stop();
      await this.startEffect(effect);
    }
  }

  // Effect implementations
  async pulseEffect(options = {}) {
    const { color = this.getRandomColor(), brightness = 80 } = options;
    
    // Flash all lights
    await Promise.all(this.lights.map(light => 
      light.setColor(color.r, color.g, color.b, brightness)
    ));
    
    // Fade out after short delay
    setTimeout(async () => {
      await Promise.all(this.lights.map(light => light.setBrightness(10)));
    }, 100);
  }

  async strobeEffect(options = {}) {
    const { color = { r: 255, g: 255, b: 255 } } = options;
    
    // Alternate between on and off
    const isOn = Math.random() > 0.5;
    
    if (isOn) {
      await Promise.all(this.lights.map(light => 
        light.setColor(color.r, color.g, color.b, 100)
      ));
    } else {
      await Promise.all(this.lights.map(light => light.turnOff()));
    }
  }

  async rainbowEffect(options = {}) {
    const { speed = 1 } = options;
    const time = Date.now() * speed * 0.001;
    
    for (let i = 0; i < this.lights.length; i++) {
      const hue = (time + i * 60) % 360;
      const color = this.hsvToRgb(hue, 100, 100);
      await this.lights[i].setColor(color.r, color.g, color.b, 80);
    }
  }

  async waveEffect(options = {}) {
    const { color = this.getRandomColor() } = options;
    const time = Date.now() * 0.005;
    
    for (let i = 0; i < this.lights.length; i++) {
      const brightness = Math.abs(Math.sin(time + i * 0.5)) * 80 + 20;
      await this.lights[i].setColor(color.r, color.g, color.b, brightness);
    }
  }

  async beatEffect(options = {}) {
    const colors = options.colors || this.colorPalette;
    
    // Assign random colors to each light
    const promises = this.lights.map(light => {
      const color = colors[Math.floor(Math.random() * colors.length)];
      return light.setColor(color.r, color.g, color.b, 90);
    });
    
    await Promise.all(promises);
  }

  async breatheEffect(options = {}) {
    const { color = this.getRandomColor() } = options;
    const time = Date.now() * 0.002;
    const brightness = (Math.sin(time) + 1) * 40 + 20; // 20-100% brightness
    
    await Promise.all(this.lights.map(light => 
      light.setColor(color.r, color.g, color.b, brightness)
    ));
  }

  // Utility methods
  getRandomColor() {
    return this.colorPalette[Math.floor(Math.random() * this.colorPalette.length)];
  }

  hsvToRgb(h, s, v) {
    h = h % 360;
    s = s / 100;
    v = v / 100;
    
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    
    let r, g, b;
    
    if (h < 60) {
      [r, g, b] = [c, x, 0];
    } else if (h < 120) {
      [r, g, b] = [x, c, 0];
    } else if (h < 180) {
      [r, g, b] = [0, c, x];
    } else if (h < 240) {
      [r, g, b] = [0, x, c];
    } else if (h < 300) {
      [r, g, b] = [x, 0, c];
    } else {
      [r, g, b] = [c, 0, x];
    }
    
    return {
      r: Math.round((r + m) * 255),
      g: Math.round((g + m) * 255),
      b: Math.round((b + m) * 255)
    };
  }

  // Manual beat trigger for external rhythm sources
  async triggerBeat(intensity = 1) {
    if (!this.isActive) return;
    
    const color = this.getRandomColor();
    const brightness = Math.min(100, 50 + intensity * 50);
    
    await Promise.all(this.lights.map(light => 
      light.setColor(color.r, color.g, color.b, brightness)
    ));
  }

  getStatus() {
    return {
      isActive: this.isActive,
      currentEffect: this.currentEffect,
      bpm: this.bpm,
      lightsCount: this.lights.length,
      lights: this.lights.map(light => ({ ip: light.ip, state: light.state }))
    };
  }
} 