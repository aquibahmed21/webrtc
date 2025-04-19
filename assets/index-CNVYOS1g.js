(function(){const i=document.createElement("link").relList;if(i&&i.supports&&i.supports("modulepreload"))return;for(const t of document.querySelectorAll('link[rel="modulepreload"]'))r(t);new MutationObserver(t=>{for(const n of t)if(n.type==="childList")for(const l of n.addedNodes)l.tagName==="LINK"&&l.rel==="modulepreload"&&r(l)}).observe(document,{childList:!0,subtree:!0});function a(t){const n={};return t.integrity&&(n.integrity=t.integrity),t.referrerPolicy&&(n.referrerPolicy=t.referrerPolicy),t.crossOrigin==="use-credentials"?n.credentials="include":t.crossOrigin==="anonymous"?n.credentials="omit":n.credentials="same-origin",n}function r(t){if(t.ep)return;t.ep=!0;const n=a(t);fetch(t.href,n)}})();document.querySelector("#app").innerHTML=`
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

    <button id="refresh" onclick="location.reload()" title="Refresh page">&#x1f504;</button>
`;let o=null,m=0,g=0,f=0;document.addEventListener("DOMContentLoaded",async e=>{await getMaxSupportedVideoConstraintsWithPermissions()});const h=document.querySelector("#quality"),S=document.querySelector("#framerate"),w=document.querySelector("#controls");w.addEventListener("click",async e=>{switch(e.target.id){case"start":{e.target.disabled=!0;const[n,l]=h.value.split("x").map(Number),y=Number(S.value);await b(n,l,y),localVideo.srcObject=o,o.getTracks().forEach(E=>c.addTrack(E,o)),e.target.nextElementSibling.disabled=!1,e.target.nextElementSibling.nextElementSibling.disabled=!1,e.target.nextElementSibling.nextElementSibling.nextElementSibling.nextElementSibling.disabled=!1}break;case"muteAudio":e.target.textContent=o.getAudioTracks()[0].enabled?"Unmute Audio":"Mute Audio",o.getAudioTracks()[0].enabled=!o.getAudioTracks()[0].enabled;break;case"muteVideo":e.target.textContent=o.getVideoTracks()[0].enabled?"Unmute Video":"Mute Video",o.getVideoTracks()[0].enabled=!o.getVideoTracks()[0].enabled;break;case"switchCamera":const a=(o.getVideoTracks()[0].getSettings().facingMode||"user")==="user"?"environment":"user",r={video:{width:g,height:m,frameRate:f,facingMode:{ideal:a}},audio:!0},t=await navigator.mediaDevices.getUserMedia(r);o.getVideoTracks()[0].stop(),o.removeTrack(o.getVideoTracks()[0]),o.addTrack(t.getVideoTracks()[0]),o=t,localVideo.srcObject=o;break;case"hangup":localVideo.srcObject=null,o.getTracks().forEach(n=>n.stop()),o=null,e.target.disabled=!0,e.target.previousElementSibling.disabled=!0,e.target.previousElementSibling.previousElementSibling.disabled=!0,e.target.previousElementSibling.previousElementSibling.previousElementSibling.disabled=!0,e.target.previousElementSibling.previousElementSibling.previousElementSibling.previousElementSibling.disabled=!1;break}});async function x(e,i,a){try{const r={video:{width:{exact:e},height:{exact:i},frameRate:{exact:a}},audio:!0};return await navigator.mediaDevices.getUserMedia(r)}catch(r){return console.error("Failed to get media stream:",r),null}}async function b(e,i,a){m=i,g=e,f=a;const r=await x(e,i,a);if(!r)return!1;const t=r.getVideoTracks()[0];if(o){const n=o.getVideoTracks()[0];n&&n.stop(),o.removeTrack(n),o.addTrack(t)}else o=r;return!0}h.addEventListener("change",async e=>{if(!o)return;const[i,a]=e.target.value.split("x").map(Number);await b(i,a,f)});S.addEventListener("change",async e=>{if(!o)return;const i=Number(e.target.value);await b(g,m,i)});location.hash||(location.hash=Math.floor(Math.random()*16777215).toString(16));const T=location.hash.substring(1),u=new ScaleDrone("EoIG3R1I4JdyS4L1"),v="observable-"+T,k={iceServers:[{urls:"stun:stun.l.google.com:19302"}]};let d,c;function V(){}function s(e){console.error(e)}u.on("open",e=>{if(e)return console.error(e);d=u.subscribe(v),d.on("open",i=>{i&&s(i)}),d.on("members",i=>{console.log("MEMBERS",i);const a=i.length===2;M(a)})});function p(e){u.publish({room:v,message:e})}function M(e){c=new RTCPeerConnection(k),c.onicecandidate=a=>{a.candidate&&p({candidate:a.candidate})},e&&(c.onnegotiationneeded=()=>{c.createOffer().then(i).catch(s)}),c.ontrack=a=>{const r=a.streams[0];(!remoteVideo.srcObject||remoteVideo.srcObject.id!==r.id)&&(remoteVideo.srcObject=r),d.on("data",(t,n)=>{n.id!==u.clientId&&(t.sdp?c.setRemoteDescription(new RTCSessionDescription(t.sdp),()=>{c.remoteDescription.type==="offer"&&c.createAnswer().then(i).catch(s)},s):t.candidate&&c.addIceCandidate(new RTCIceCandidate(t.candidate),V,s))})};function i(a){c.setLocalDescription(a,()=>p({sdp:c.localDescription}),s)}}
