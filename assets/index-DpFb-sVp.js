(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))t(n);new MutationObserver(n=>{for(const a of n)if(a.type==="childList")for(const u of a.addedNodes)u.tagName==="LINK"&&u.rel==="modulepreload"&&t(u)}).observe(document,{childList:!0,subtree:!0});function l(n){const a={};return n.integrity&&(a.integrity=n.integrity),n.referrerPolicy&&(a.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?a.credentials="include":n.crossOrigin==="anonymous"?a.credentials="omit":a.credentials="same-origin",a}function t(n){if(n.ep)return;n.ep=!0;const a=l(n);fetch(n.href,a)}})();async function h(){return await navigator.mediaDevices.getUserMedia({video:!0,audio:!0})}function g(s,e,l=!1){const t=document.createElement("video");t.srcObject=s,t.id=e,t.autoplay=!0,t.playsInline=!0,l&&(t.muted=!0),document.getElementsByClassName("Channel")[0].appendChild(t)}function v(s,e,l){const t=new window.Scaledrone("EoIG3R1I4JdyS4L1"),n=t.subscribe(s);return t.on("open",e),n.on("message",l),{drone:t,room:n}}const m={};let f;function S(s,e){f=s;const l="observable-e7b2d4",{drone:t,room:n}=v(l,a,u);function a(c){if(c)return console.error(c);console.log("Connected to Scaledrone")}function u(c){const{data:d,member:b}=c,i=b.id;if(i!==t.clientId)switch(d.type){case"offer":p(i,!1,e),m[i].setRemoteDescription(new RTCSessionDescription(d.offer)),m[i].createAnswer().then(r=>{m[i].setLocalDescription(r),t.publish({room:l,message:{type:"answer",answer:r,to:i}})});break;case"answer":d.to===t.clientId&&m[i]&&m[i].setRemoteDescription(new RTCSessionDescription(d.answer));break;case"candidate":d.to===t.clientId&&m[i]&&m[i].addIceCandidate(new RTCIceCandidate(d.candidate));break}}n.on("members",c=>{c.forEach(d=>{d.id!==t.clientId&&p(d.id,!0,e)})});function p(c,d,b){const i=new RTCPeerConnection;i.onicecandidate=r=>{r.candidate&&t.publish({room:l,message:{type:"candidate",candidate:r.candidate,to:c}})},i.ontrack=r=>{b(r.streams[0],c)},f.getTracks().forEach(r=>i.addTrack(r,f)),d&&i.createOffer().then(r=>{i.setLocalDescription(r),t.publish({room:l,message:{type:"offer",offer:r,to:c}})}),m[c]=i}}document.querySelector("#app").innerHTML=`
    <div class="Channel"></div>
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
`;let o=null;async function E(){o=await h(),g(o,"localVideo",!0),S(o,(s,e)=>{document.getElementById(e)||g(s,e)})}document.querySelector("#controls").addEventListener("click",async s=>{const e=s.target;switch(s.target.id){case"start":await E(),e.disabled=!0,e.nextElementSibling.disabled=!1,e.nextElementSibling.nextElementSibling.disabled=!1,e.nextElementSibling.nextElementSibling.nextElementSibling.nextElementSibling.disabled=!1;case"muteAudio":e.textContent=o.getAudioTracks()[0].enabled?"Unmute Audio":"Mute Audio",o.getAudioTracks()[0].enabled=!o.getAudioTracks()[0].enabled;break;case"muteVideo":e.textContent=o.getVideoTracks()[0].enabled?"Unmute Video":"Mute Video",o.getVideoTracks()[0].enabled=!o.getVideoTracks()[0].enabled;break;case"switchCamera":const n=(o.getVideoTracks()[0].getSettings().facingMode||"user")==="user"?"environment":"user",a={video:{width:localwidth,height:localheight,frameRate:localframeRate,facingMode:{ideal:n}},audio:!0},u=await navigator.mediaDevices.getUserMedia(a);o.getVideoTracks()[0].stop(),o.removeTrack(o.getVideoTracks()[0]),o.addTrack(u.getVideoTracks()[0]),o=u,g(o,"localVideo",!0);break;case"hangup":o.getTracks().forEach(p=>p.stop()),o=null,e.disabled=!0,e.previousElementSibling.disabled=!0,e.previousElementSibling.previousElementSibling.disabled=!0,e.previousElementSibling.previousElementSibling.previousElementSibling.disabled=!0,e.previousElementSibling.previousElementSibling.previousElementSibling.previousElementSibling.disabled=!1;break}});
