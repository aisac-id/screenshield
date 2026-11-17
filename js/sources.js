// ScreenShield sources — demo dashboard image or a shared screen/tab.
"use strict";

export class SourceManager {
  constructor(onStatus) {
    this.onStatus = onStatus;
    this.kind = "none";
    this.img = null;
    this.video = null;
    this.stream = null;
    this.w = 0;
    this.h = 0;
  }

  async useDemo() {
    this.stop();
    if (!this.img) {
      this.img = new Image();
      await new Promise((res, rej) => {
        this.img.onload = res;
        this.img.onerror = rej;
        this.img.src = "assets/demo-dashboard.png";
      });
    }
    this.kind = "demo";
    this.w = this.img.width;
    this.h = this.img.height;
    this.onStatus("demo");
  }

  async useScreen() {
    this.stop();
    this.stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 15 } },
      audio: false,
    });
    const track = this.stream.getVideoTracks()[0];
    track.addEventListener("ended", () => this.onStatus("share-ended"));
    this.video = document.createElement("video");
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.srcObject = this.stream;
    await this.video.play();
    await new Promise((res) => {
      const check = () => (this.video.videoWidth ? res() : setTimeout(check, 100));
      check();
    });
    this.kind = "screen";
    this.w = this.video.videoWidth;
    this.h = this.video.videoHeight;
    this.onStatus("screen");
  }

  // draw current source content into ctx (full size)
  draw(ctx) {
    if (this.kind === "demo" && this.img) ctx.drawImage(this.img, 0, 0);
    else if (this.kind === "screen" && this.video && this.video.readyState >= 2) {
      if (this.video.videoWidth !== this.w) {
        this.w = this.video.videoWidth;
        this.h = this.video.videoHeight;
      }
      ctx.drawImage(this.video, 0, 0);
    }
  }

  ready() {
    return this.kind === "demo" ? !!this.img
      : this.kind === "screen" ? this.video && this.video.readyState >= 2 : false;
  }

  stop() {
    if (this.stream) {
      for (const t of this.stream.getTracks()) t.stop();
      this.stream = null;
    }
    if (this.video) { this.video.srcObject = null; this.video = null; }
    this.kind = "none";
  }
}