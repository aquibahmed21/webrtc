(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const o of document.querySelectorAll('link[rel="modulepreload"]'))r(o);new MutationObserver(o=>{for(const n of o)if(n.type==="childList")for(const l of n.addedNodes)l.tagName==="LINK"&&l.rel==="modulepreload"&&r(l)}).observe(document,{childList:!0,subtree:!0});function i(o){const n={};return o.integrity&&(n.integrity=o.integrity),o.referrerPolicy&&(n.referrerPolicy=o.referrerPolicy),o.crossOrigin==="use-credentials"?n.credentials="include":o.crossOrigin==="anonymous"?n.credentials="omit":n.credentials="same-origin",n}function r(o){if(o.ep)return;o.ep=!0;const n=i(o);fetch(o.href,n)}})();document.querySelector("#app").innerHTML=`
   <div class="Channel">
    <video id="remoteVideo" autoplay></video>
    <video id="localVideo" autoplay muted></video>
    </div>

    <div class="controls" id="controls">
      <button id="start">Start</button>
      <button id="muteAudio" disabled>Mute Audio</button>
      <button id="muteVideo" disabled>Mute Video</button>
      <button id="switchCamera" disabled>Switch Camera</button>
      <button id="hangup" disabled>Hang Up</button>
    </div>

    <label for="quality">Select quality:</label>
    <select id="quality">
      <option value="160x120">160x120</option>
      <option value="320x240">320x240</option>
      <option value="640x480">640x480</option>
      <option value="1280x720">1280x720</option>
      <option value="1920x1080">1920x1080</option>
    </select>

    <label for="framerate">Select framerate:</label>
    <select id="framerate">
      <option value="10">10</option>
      <option value="20">20</option>
      <option value="30">30</option>
      <option value="60">60</option>
    </select>
`;let a=null,v=0,x=0,y=0;document.addEventListener("DOMContentLoaded",async e=>{await A()});const E=document.querySelector("#quality"),w=document.querySelector("#framerate"),M=document.querySelector("#controls");M.addEventListener("click",async e=>{switch(e.target.id){case"start":{e.target.disabled=!0;const[t,i]=E.value.split("x").map(Number),r=Number(w.value);await g(t,i,r),localVideo.srcObject=a,a.getTracks().forEach(o=>s.addTrack(o,a)),e.target.nextElementSibling.disabled=!1,e.target.nextElementSibling.nextElementSibling.disabled=!1,e.target.nextElementSibling.disabled=!1,e.target.nextElementSibling.nextElementSibling.nextElementSibling.nextElementSibling.disabled=!1}break;case"muteAudio":e.target.textContent=a.getAudioTracks()[0].enabled?"Unmute Audio":"Mute Audio",a.getAudioTracks()[0].enabled=!a.getAudioTracks()[0].enabled;break;case"muteVideo":e.target.textContent=a.getVideoTracks()[0].enabled?"Unmute Video":"Mute Video",a.getVideoTracks()[0].enabled=!a.getVideoTracks()[0].enabled;break;case"switchCamera":a.getVideoTracks()[0].getSettings().facingMode=a.getVideoTracks()[0].getSettings().facingMode==="user"?"environment":"user";break;case"hangup":localVideo.srcObject=null,s.close(),a.getTracks().forEach(t=>t.stop()),a=null,e.target.disabled=!0,e.target.previousElementSibling.disabled=!0,e.target.previousElementSibling.previousElementSibling.disabled=!0,e.target.previousElementSibling.previousElementSibling.previousElementSibling.disabled=!0,e.target.previousElementSibling.previousElementSibling.previousElementSibling.previousElementSibling.disabled=!1;break}});async function C(e,t,i){try{const r={video:{width:{exact:e},height:{exact:t},frameRate:{exact:i}},audio:!0};return await navigator.mediaDevices.getUserMedia(r)}catch(r){return console.error("Failed to get media stream:",r),null}}async function g(e,t,i){v=t,x=e,y=i;const r=await C(e,t,i);if(!r)return!1;const o=r.getVideoTracks()[0];if(a){const n=a.getVideoTracks()[0];n&&n.stop(),a.removeTrack(n),a.addTrack(o)}else a=r;return!0}E.addEventListener("change",async e=>{if(!a)return;const[t,i]=e.target.value.split("x").map(Number);await g(t,i,y)});w.addEventListener("change",async e=>{if(!a)return;const t=Number(e.target.value);await g(x,v,t)});location.hash||(location.hash=Math.floor(Math.random()*16777215).toString(16));const O=location.hash.substring(1),m=new ScaleDrone("EoIG3R1I4JdyS4L1"),T="observable-"+O,q={iceServers:[{urls:"stun:stun.l.google.com:19302"}]};let u,s;function L(){}function c(e){console.error(e)}m.on("open",e=>{if(e)return console.error(e);u=m.subscribe(T),u.on("open",t=>{t&&c(t)}),u.on("members",t=>{console.log("MEMBERS",t);const i=t.length===2;R(i)})});function k(e){m.publish({room:T,message:e})}function R(e){s=new RTCPeerConnection(q),s.onicecandidate=t=>{t.candidate&&k({candidate:t.candidate})},e&&(s.onnegotiationneeded=()=>{s.createOffer().then(S).catch(c)}),s.ontrack=t=>{const i=t.streams[0];(!remoteVideo.srcObject||remoteVideo.srcObject.id!==i.id)&&(remoteVideo.srcObject=i)},u.on("data",(t,i)=>{i.id!==m.clientId&&(t.sdp?s.setRemoteDescription(new RTCSessionDescription(t.sdp),()=>{s.remoteDescription.type==="offer"&&s.createAnswer().then(S).catch(c)},c):t.candidate&&s.addIceCandidate(new RTCIceCandidate(t.candidate),L,c))})}function S(e){s.setLocalDescription(e,()=>k({sdp:s.localDescription}),c)}async function A(){var e,t,i;try{const r=await navigator.permissions.query({name:"camera"}),o=await navigator.permissions.query({name:"microphone"}),n=r.state==="granted",l=o.state==="granted";console.log(!n||!l?"Requesting permissions...":"Permissions already granted.");const p=await navigator.mediaDevices.getUserMedia({video:!0,audio:!0}),d=p.getVideoTracks()[0].getCapabilities(),f=((e=d.width)==null?void 0:e.max)||null,b=((t=d.height)==null?void 0:t.max)||null,h=((i=d.frameRate)==null?void 0:i.max)||null;return console.log("Supported Capabilities:",d),console.log(`Max resolution: ${f}x${b}, Max FPS: ${h}`),p.getTracks().forEach(V=>V.stop()),{maxWidth:f,maxHeight:b,maxFrameRate:h}}catch(r){return console.error("Media access error or permission denied:",r),null}}
