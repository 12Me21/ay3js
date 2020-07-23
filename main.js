var audioContext = new AudioContext({
	sampleRate: (1.75*1000*1000)/16
})
var node
audioContext.audioWorklet.addModule('worker.js').then(()=>{
	node = new AudioWorkletNode(audioContext, 'ay-3-8910')
	node.connect(audioContext.destination);
	node.port.onmessage = function(x) {
		//$disp.textContent = x.data.data.registers.map(x=>"|".repeat(x)).join("\n");

		var ctx=$canvas.getContext("2d");
		ctx.fillStyle="rgba(0,0,0,01)";
		ctx.fillRect(0,0,$canvas.width,$canvas.height);
		
		for(var i=0;i<4;i++){
			drawWave(x.data.data,i,$canvas);
		}
	}
})
function EnvelopeOscillator(){
}
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

function eated_file_go(){
	var reader=new FileReader();
	reader.onload=function(x){
		loadPSG(reader.result);
	};
	reader.readAsArrayBuffer(this.files[0]);
}

function loadPSG(psg){
	var psgFile=new Uint8Array(psg);
	node.port.postMessage({type:"file",file:psgFile});
}


$input.onchange = eated_file_go;


function map(v,start2,end2){
	return v*(end2-start2)+start2;
}

function rgb(r,g,b){
	return "rgb("+r+","+g+","+b+")";
}

var beamwidth = 0.01;
var opt_bright = 0.05;
function vline(ctx,x,y1,y2,ymax){
	var ycent=(y1+y2)/2;
	var ylen=Math.abs(y2-y1);

	
	var len = ylen/ymax + beamwidth; //length of line
	var each = 1/len; //brightness of each pixel in line
	bright = each*opt_bright;
	if(isNaN(bright))
		alert("NAN+"+y1+","+y2)
	
	if (bright>1){
		len *= bright;
		bright = 1;
	}
	if (bright<0.5)
		bright=0.5;
	ctx.fillStyle = "white"//rgb(bright*255,bright*255,bright*255);
	ctx.fillRect(x, y1, 2,y2-y1+2);
	//ctx.fillRect(x, ycent-len*ymax/2, 1, len*ymax);
}

function drawWave(ay,index,canvas){
	var height=canvas.height/4;
	var width=canvas.width;
	var y=height*index;
	var ctx=canvas.getContext("2d");
	//ctx.strokeStyle="limegreen";
	//ctx.lineWidth=3;
	//ctx.beginPath();
	var noise_period=ay.oscillator.noise.period || 1;
	var env_period=ay.oscillator.envelope.period || 1;
	var noise_state=0;
	var noise_count=0;
	var env_state=0;
	if (index == 3) {
		var tone_period=ay.oscillator.envelope.period || 1;
		var volume = ay.volumes[15]/65535;
		var channel = {tone: ay.testEnable};
	} else {
		var tone_period=ay.oscillator[index].period || 1;
		var channel=ay.channel[index];
		var volume=ay.volumes[channel.volume]/65535;
	}
	var step=1;
	var step2=5;

	var sync_period=0;
	if(channel.envelope)
		sync_period=env_period*64;
	else
		sync_period=tone_period;

	var c=(width/2*step2 /* -tone_period/2 */ );
	var tone_state=!(c / sync_period & 1);
	var tone_count=Math.floor(sync_period - (c % sync_period));
	var env_count=Math.floor(sync_period - (c % sync_period));
	var env_state=Math.floor(c / sync_period);
	while(env_state>=128 && sync_period)
		env_state-=64;
	var maxvol = volume;
	if(channel.envelope) {
		maxvol = 1;
		tone_state = 0;
		//temp:
		tone_count = ay.oscillator.envelope.counter - ay.oscillator[index].counter
	}
	var envvol=1;
	
	var old_draw_y=0;
	var draw_y=0;
	
	for(var x=0;x<width;x++){
		var state = 0;
		//var maxvol = 0;
		for(var i=0;i<step2;i++){
			if(channel.envelope){
				volume=ay.volumes[EnvelopeOscillator.patterns[ay.oscillator.envelope.mode][env_state]]/65535;
				/*if(channel.tone && tone_period==1){
					envvol=envvol/2;
					tone_state=0;
				}*/
			}
			tone_count+=step;
			noise_count+=step;
			env_count+=step;
			while (tone_period && tone_count>=tone_period){
				tone_state=!tone_state;
				tone_count-=tone_period;
			}
			while (noise_period && noise_count>=noise_period){
				noise_state=Math.random()<0.5;
				noise_count-=noise_period;
			}
			while (env_period && env_count>=env_period){
				env_state++;
				if(env_state>=128)
					env_state-=64;
				env_count-=env_period;
			}
			
			state += tone_state && channel.tone || noise_state && channel.noise ? 0 : volume;
		}
		state /= step2;
		
		old_draw_y = draw_y;
		draw_y = y+height/2+map(state/maxvol,height*.4,height*-.4)*maxvol;
		

		if(maxvol){
			vline(ctx,x,old_draw_y,draw_y,height);
					//if(isNaN(draw_y))
		//	alert("HECK+"+y+")"+maxvol)
		}
	}
	//ctx.stroke();
}
