import { afterEach, expect, it, vi } from "vitest";
import { startListening } from "@/lib/voice";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function browser() {
  const recognition = {start:vi.fn(),stop:vi.fn(),onerror:null as null | ((event:{error:string})=>void),onend:null as null | (()=>void)};
  const ctor = vi.fn(function() {return recognition;});
  vi.stubGlobal("window", {SpeechRecognition:ctor});
  return {recognition,ctor};
}
it("prefers configured recording over an exposed but unusable Web Speech service", async () => {
  const {ctor} = browser();
  const stopTrack = vi.fn();
  const getUserMedia = vi.fn().mockResolvedValue({getTracks:()=>[{stop:stopTrack}]});
  vi.stubGlobal("navigator", {mediaDevices:{getUserMedia}});
  const record = {state:"inactive",start:vi.fn(),stop:vi.fn()};
  const recorder = Object.assign(vi.fn(function(){return record;}), {isTypeSupported:()=>true});
  vi.stubGlobal("MediaRecorder",recorder);
  vi.stubGlobal("fetch",vi.fn().mockResolvedValue(Response.json({available:true})));
  const handle = startListening({onFinal:vi.fn()});
  await vi.waitFor(() => expect(record.start).toHaveBeenCalled());
  expect(ctor).not.toHaveBeenCalled();
  handle?.stop();
  expect(stopTrack).toHaveBeenCalled();
});
it("does not restart recognition forever after a network failure", async () => {
  const {recognition} = browser();
  vi.stubGlobal("MediaRecorder",undefined);
  vi.stubGlobal("fetch",vi.fn().mockResolvedValue(Response.json({available:false})));
  const onError=vi.fn(), onEnd=vi.fn();
  startListening({onFinal:vi.fn(),onError,onEnd,continuous:true});
  await vi.waitFor(() => expect(recognition.start).toHaveBeenCalledOnce());
  recognition.onerror?.({error:"network"}); recognition.onend?.();
  expect(recognition.start).toHaveBeenCalledOnce();
  expect(onError).toHaveBeenCalled(); expect(onEnd).toHaveBeenCalledOnce();
});
it("cancels a pending capability check before opening the microphone", async () => {
  const {ctor} = browser();
  let finish!: (response:Response)=>void;
  vi.stubGlobal("fetch",vi.fn(()=>new Promise<Response>(resolve=>{finish=resolve;})));
  const onEnd=vi.fn();
  startListening({onFinal:vi.fn(),onEnd})?.stop();
  finish(Response.json({available:false}));
  await new Promise(resolve=>setTimeout(resolve,0));
  expect(ctor).not.toHaveBeenCalled(); expect(onEnd).toHaveBeenCalledOnce();
});
