// Type definitions for configstore 0.3.0
// Project: https://github.com/yeoman/configstore
// Definitions by: Bart van der Schoor <https://github.com/Bartvds>
// Definitions: https://github.com/borisyankov/DefinitelyTyped

declare module 'configstore' {

    class Configstore {

        public all:Object;
        public size:number;
        public path:String;

        constructor(id:String, defaults?:any);
        set(key:string, val:any):void;
        get(key:string):any;
        del(key:string):void;
    }

    export = Configstore;

}
