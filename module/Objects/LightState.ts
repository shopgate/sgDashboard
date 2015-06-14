export enum LightStatus {
	BLINKING,
	ON
}

export enum  LightColor {
	RED,
	GREEN,
	BLUE,
	ORANGE
}

export interface LightState {
	location:string;
	lightId:number;
	lightStatus: LightStatus;
	color:LightColor;
	brightness:number;
}