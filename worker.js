function Oscillator(){
	this.period=0;
	this.state=false;
	this.counter=0;
}
Oscillator.prototype.step=function(){
	if(++this.counter>=this.period){
		this.counter=0;
		this.nextState();
	}
}
Oscillator.prototype.reset=function(){
	this.counter = 0;
	this.period = 0;
	this.state = false;
}

function ToneOscillator(){
	Oscillator.call(this);
}
ToneOscillator.prototype = Object.create(Oscillator.prototype);
ToneOscillator.prototype.nextState=function(){
	this.state=!this.state;
}

function NoiseOscillator(){
	Oscillator.call(this);
}
NoiseOscillator.prototype = Object.create(Oscillator.prototype);
NoiseOscillator.prototype.nextState=function(){
	this.state=Math.random()<0.5;
}

function EnvelopeOscillator(){
	Oscillator.call(this);
	this.state=0;
	this.mode=0;
}
EnvelopeOscillator.prototype = Object.create(Oscillator.prototype);
EnvelopeOscillator.patterns = (function(){
	var patterns=new Array(16);
	for(var env=0;env<16;env++){
		patterns[env]=new Array(128);
		var hold=0;
		var dir=(env&4)? 1:-1;
		var vol=(env&4)?-1:32;
		for(var pos=0;pos<128;pos++){
			if(!hold){
				vol+=dir;
				if(vol<0 || vol>=32){
					if(env&8){
						if(env&2)
							dir=-dir;
						vol=(dir>0)?0:31;
						if(env&1){
							hold=1;
							vol=(dir>0)?31:0;
						}
					}else{
						vol=0;
						hold=1;
					}
				}
			}
			patterns[env][pos] = (vol>>1);
		}
	}
	return patterns;
})();
EnvelopeOscillator.prototype.nextState = function(){
	this.state += 1;
	if(this.state>=128)
		this.state-=64;
}
EnvelopeOscillator.prototype.volume = function(){
	return EnvelopeOscillator.patterns[this.mode][this.state|0];
}
Oscillator.prototype.reset=function(){
	this.counter = 0;
	this.period = 0;
	this.state = 0;
	this.mode = 0;
}

function Channel(){
	this.tone=false;
	this.noise=false;
	this.volume=0;
	this.envelope=false;
}
Channel.prototype.getState = function() {
	return {
		tone: this.tone,
		noise: this.noise,
		volume: this.volume,
		envelope: this.envelope
	}
}

function AY(onInterrupt, clock){
	this.clock=(clock || 1.75*1000*1000)/16*2;
	this.channel={
		[0]: new Channel(),
		[1]: new Channel(),
		[2]: new Channel(),
	};
	this.oscillator={
		[0]: new ToneOscillator(),
		[1]: new ToneOscillator(),
		[2]: new ToneOscillator(),
		noise: new NoiseOscillator(),
		envelope: new EnvelopeOscillator(),
	};
	this.testEnable = true;
	this.counter=0;
	this.onInterrupt=onInterrupt;
	this.registers=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
}
AY.volumes=[0, 836, 1212, 1773, 2619, 3875, 5397, 8823, 10392, 16706, 23339, 29292, 36969, 46421, 55195, 65535];
AY.prototype.reset=function(){
	for(var i=0;i<16;i++){
		this.setRegister(i,0);
	}
	for (var n in this.oscillator)
		this.oscillator[n].reset();
}
AY.prototype.getState=function(){
	var osc = {};
	for (var n in this.oscillator)
		osc[n] = {
			state: this.oscillator[n].state,
			counter: this.oscillator[n].counter,
			period: this.oscillator[n].period,
			mode: this.oscillator[n].mode
		}
	var ret = {
		registers: this.registers,
		oscillator: osc,
		volumes: AY.volumes,
		channel: {}
	};
	for (var n in this.channel)
		ret.channel[n] = this.channel[n].getState();
	return ret;
}
AY.prototype.cycle=function(steps){
	var output=[0,0,0,0];
	//this.oscillator.envelope.period = 0x1A2;
	for(var j=0;j<steps;j++){
		for(var i=0;i<3;i++){
			this.oscillator[i].step();
		}
		this.oscillator.noise.step();
		this.oscillator.envelope.step();
		if(this.onInterrupt)
			if(++this.counter>this.clock/50){
				var result=this.onInterrupt(this);
				if(!result)
					return false;
				this.counter=0;
			}
		
		for(var i=0;i<3;i++){
			var level = 0;
			if(this.channel[i].tone && this.oscillator[i].state  ||  this.channel[i].noise && this.oscillator.noise.state){
				level=0;
			}else{
				if(this.channel[i].envelope){
					level=this.oscillator.envelope.volume();
				}else{
					level=this.channel[i].volume;
				}
			}
			output[i]+=AY.volumes[level]/steps;
		}
		if (0 && !this.testEnable) {
			output[3]+=AY.volumes[(this.oscillator.envelope.state&1) ? 15 : 0]/steps;
		}
	}
	return output;
}

AY.prototype.setRegister=function(register,value){
	this.registers[register] = value;
	switch(register){
	case 0:case 2:case 4:
		this.oscillator[register>>1].period = this.oscillator[register>>1].period&0xFF00 | value&0xFF
	break;case 1:case 3:case 5:
		this.oscillator[register-1>>1].period = this.oscillator[register-1>>1].period&0x00FF | (value&0x0F)<<8
	break;case 6:
		this.oscillator.noise.period = (value & 0b11111)*2
	break;case 7:
		for(var i=0;i<3;i++){
			this.channel[i].tone = !(value & 0b000001<<i)
			this.channel[i].noise= !(value & 0b001000<<i)
		}
	break;case 8:case 9:case 10:
		this.channel[register-8].volume = value & 0b1111;
		this.channel[register-8].envelope = value & 0b10000;
	break;case 11:
		this.oscillator.envelope.period = this.oscillator.envelope.period&0xFF00 | value&0xFF
	break;case 12:
		this.oscillator.envelope.period = this.oscillator.envelope.period&0x00FF | (value&0xFF)<<8
	break;case 13:
		// this should reset the counter
		this.oscillator.envelope.mode = value & 0xF;
	break;case 14:
		this.testEnable = !!(value & 1);
	}
}

function Player() {
	this.ay = new AY(()=>{
		var x = this.interrupt();
		if (this.onInterrupt)
			this.onInterrupt();
		return x;
	});
}
Player.prototype.setPsgFile = function(data) {
	this.psgFile = data;
	this.psgDelay = 0;
	this.psgIndex = 17;
	this.ay.reset();
}
Player.prototype.interrupt = function() {
	if (this.psgDelay > 0) {
		this.psgDelay--;
		return true;
	}
	while(1){
		if (this.psgIndex >= this.psgFile.length)
			return false;
		var reg = this.psgFile[this.psgIndex++];
		if (reg<=0xF) {
			this.ay.setRegister(reg, this.psgFile[this.psgIndex++]);
		} else if (reg==0xFD) {
			return false;
		} else if (reg==0xFE) {
			this.psgDelay = this.psgFile[this.psgIndex++]*4-1;
			return true;
		//???
		} else if (reg==0xFF) {
			return true;
		} else {
			return false;
		}
	}
}

class AY3Processor extends AudioWorkletProcessor {
	constructor() {
		super();
		this.player = new Player();
		this.tickError = 0;
		this.port.onmessage = event => {
			var d = event.data;
			if (d.type=="file") {
				this.player.setPsgFile(d.file);
				this.running = true;
			}
		}
		this.player.onInterrupt = ()=>{
			this.port.postMessage({type:"interrupt",data:this.player.ay.getState()})
		}
		this.cyclesPerSample = this.player.ay.clock / sampleRate;
		console.log("sample rate", sampleRate)
	}
	process(_, outputs, parameters) {
		var left = outputs[0][0];
		//var right = outputs[0][1];
		//console.log(outputs);
		//throw'shit'
		if (this.running) {
			for (var i = 0; i < left.length; i++) {
				var cycles = this.cyclesPerSample + this.tickError | 0;
				var x = this.player.ay.cycle(cycles);
				if (!x) {
					this.running = false;
					return;
				}
				this.tickError += this.cyclesPerSample-cycles;
				left[i]  = (x[0]*.5+x[1]*.5+x[2]*.5+x[3]*.5)/4/65535;
				//right[i] = (x[0]*.5+x[1]*.5+x[2]*.5+x[3]*.5)/3/65535;
			}
		}
		return true;
	}
}

registerProcessor("ay-3-8910", AY3Processor);
