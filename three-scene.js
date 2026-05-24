import * as THREE from 'three';
import { gsap } from 'gsap';

export class ThreeScene {
  constructor(containerId, onProgress) {
    this.container = document.getElementById(containerId);
    this.onProgress = onProgress || (() => {});
    
    // Core parameters
    this.width = this.container.clientWidth;
    this.height = this.container.clientHeight;
    
    // Flight path parameters
    this.scrollProgress = 0;
    this.planeTargetX = 0;
    this.planeTargetY = 0;
    this.planeSpeed = 0.05;
    
    // Advanced flight game telemetry
    this.gameActive = false;
    this.gameScore = 0;
    this.gameEnergy = 100;
    this.keyboardInput = { up: false, down: false, left: false, right: false };
    this.gameRings = [];
    this.onGameUpdate = null; // Callback hook
    this.onCollisionRing = null; // Audio beep hook
    
    // Section colors (Dawn, High Noon, Sunset, Cosmic Starry Night)
    this.colors = {
      dawn: { sky: 0x0a1428, ambient: 0xffa07a, directional: 0xffd700 },
      noon: { sky: 0x0052d4, ambient: 0xffffff, directional: 0x6fb1fc },
      sunset: { sky: 0x2b1055, ambient: 0xf857a6, directional: 0xff7e5f },
      night: { sky: 0x030610, ambient: 0x1f2e4d, directional: 0x00ffff }
    };
    
    this.currentSkyColor = new THREE.Color(this.colors.dawn.sky);
    
    this.init();
  }
  
  init() {
    this.onProgress("Initializing Scene...", 20);
    
    // 1. Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = this.currentSkyColor;
    this.scene.fog = new THREE.FogExp2(this.currentSkyColor.getHex(), 0.015);
    
    // 2. Camera Setup
    this.camera = new THREE.PerspectiveCamera(60, this.width / this.height, 0.1, 1000);
    this.camera.position.set(0, 2, 12);
    
    // 3. Renderer Setup
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);
    
    this.onProgress("Building Avionics...", 40);
    
    // 4. Lights
    this.ambientLight = new THREE.AmbientLight(this.colors.dawn.ambient, 0.8);
    this.scene.add(this.ambientLight);
    
    this.dirLight = new THREE.DirectionalLight(this.colors.dawn.directional, 1.2);
    this.dirLight.position.set(5, 10, 7);
    this.scene.add(this.dirLight);
    
    // 5. Add custom objects
    this.createAirplane();
    this.createClouds();
    this.createStars();
    this.createGates();
    
    this.onProgress("Configuring Flight Controls...", 80);
    
    // 6. Listeners
    window.addEventListener('resize', this.onWindowResize.bind(this));
    
    this.onProgress("Takeoff Ready!", 100);
    
    // Start loop
    this.animate();
  }
  
  createAirplane() {
    this.planeGroup = new THREE.Group();
    
    // Fuselage (Main Body)
    const bodyGeom = new THREE.ConeGeometry(0.6, 4, 8);
    bodyGeom.rotateX(Math.PI / 2); // Align horizontally
    const bodyMat = new THREE.MeshStandardMaterial({ 
      color: 0xf0f4fa, 
      roughness: 0.2, 
      metalness: 0.8,
      flatShading: true
    });
    const fuselage = new THREE.Mesh(bodyGeom, bodyMat);
    this.planeGroup.add(fuselage);
    
    // Canopy (Cockpit Glass)
    const cockpitGeom = new THREE.SphereGeometry(0.35, 8, 8);
    cockpitGeom.scale(1, 1, 2);
    const cockpitMat = new THREE.MeshStandardMaterial({ 
      color: 0x00ffff, 
      roughness: 0.1, 
      metalness: 0.9, 
      transparent: true, 
      opacity: 0.6 
    });
    const cockpit = new THREE.Mesh(cockpitGeom, cockpitMat);
    cockpit.position.set(0, 0.3, 0.4);
    this.planeGroup.add(cockpit);
    
    // Main Wings (Low-poly delta wings)
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(3.2, -1.2);
    wingShape.lineTo(0.5, -0.6);
    wingShape.lineTo(0, -0.2);
    wingShape.lineTo(-0.5, -0.6);
    wingShape.lineTo(-3.2, -1.2);
    wingShape.lineTo(0, 0);
    
    const extrudeSettings = { depth: 0.08, bevelEnabled: false };
    const wingGeom = new THREE.ExtrudeGeometry(wingShape, extrudeSettings);
    wingGeom.rotateX(Math.PI / 2);
    wingGeom.translate(0, 0, 0.2);
    
    const wings = new THREE.Mesh(wingGeom, bodyMat);
    this.planeGroup.add(wings);
    
    // Horizontal Stabilizers (Tail wings)
    const tailStabilizersShape = new THREE.Shape();
    tailStabilizersShape.moveTo(0, 0);
    tailStabilizersShape.lineTo(1.2, -0.5);
    tailStabilizersShape.lineTo(0.2, -0.3);
    tailStabilizersShape.lineTo(0, -0.1);
    tailStabilizersShape.lineTo(-0.2, -0.3);
    tailStabilizersShape.lineTo(-1.2, -0.5);
    tailStabilizersShape.lineTo(0, 0);
    
    const tailWingsGeom = new THREE.ExtrudeGeometry(tailStabilizersShape, extrudeSettings);
    tailWingsGeom.rotateX(Math.PI / 2);
    tailWingsGeom.translate(0, 0, -1.5);
    const tailWings = new THREE.Mesh(tailWingsGeom, bodyMat);
    this.planeGroup.add(tailWings);
    
    // Vertical Fin (Vertical stabilizer)
    const verticalFinShape = new THREE.Shape();
    verticalFinShape.moveTo(0, 0);
    verticalFinShape.lineTo(0, 0.8);
    verticalFinShape.lineTo(-0.6, 0.6);
    verticalFinShape.lineTo(-0.8, 0);
    verticalFinShape.lineTo(0, 0);
    
    const finExtrudeSettings = { depth: 0.05, bevelEnabled: false };
    const finGeom = new THREE.ExtrudeGeometry(verticalFinShape, finExtrudeSettings);
    finGeom.rotateY(Math.PI / 2);
    finGeom.translate(0, 0, -1.5);
    
    const verticalFin = new THREE.Mesh(finGeom, bodyMat);
    this.planeGroup.add(verticalFin);
    
    // Engine Exhaust (Glowing orange cone at tail)
    const exhaustGeom = new THREE.ConeGeometry(0.3, 0.5, 8);
    exhaustGeom.rotateX(-Math.PI / 2);
    const exhaustMat = new THREE.MeshBasicMaterial({ color: 0xff6600 });
    const exhaust = new THREE.Mesh(exhaustGeom, exhaustMat);
    exhaust.position.set(0, 0, -2.1);
    this.planeGroup.add(exhaust);
    
    // Glow jet stream light
    this.jetLight = new THREE.PointLight(0xff4400, 2, 5);
    this.jetLight.position.set(0, 0, -2.3);
    this.planeGroup.add(this.jetLight);
    
    // Add Wingtip Vortices (Vapor Trails)
    this.trailLeftGeometry = new THREE.BufferGeometry();
    this.trailRightGeometry = new THREE.BufferGeometry();
    const maxTrailPoints = 30;
    this.trailPointsLeft = [];
    this.trailPointsRight = [];
    
    for (let i = 0; i < maxTrailPoints; i++) {
      this.trailPointsLeft.push(new THREE.Vector3(-3.2, 0, -1.2));
      this.trailPointsRight.push(new THREE.Vector3(3.2, 0, -1.2));
    }
    
    this.trailLeftGeometry.setFromPoints(this.trailPointsLeft);
    this.trailRightGeometry.setFromPoints(this.trailPointsRight);
    
    const trailMat = new THREE.LineBasicMaterial({ 
      color: 0x00ffff, 
      transparent: true, 
      opacity: 0.45,
      blending: THREE.AdditiveBlending 
    });
    
    this.trailLeft = new THREE.Line(this.trailLeftGeometry, trailMat);
    this.trailRight = new THREE.Line(this.trailRightGeometry, trailMat);
    
    this.scene.add(this.trailLeft);
    this.scene.add(this.trailRight);
    
    // Positions & Scale
    this.planeGroup.scale.set(0.6, 0.6, 0.6);
    this.planeGroup.position.set(0, 0, 4);
    
    this.scene.add(this.planeGroup);
  }
  
  createClouds() {
    this.clouds = [];
    const cloudCount = 40;
    
    // Material
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xf5f9ff,
      roughness: 0.9,
      metalness: 0.1,
      flatShading: true,
      transparent: true,
      opacity: 0.8
    });
    
    for (let i = 0; i < cloudCount; i++) {
      const cloudGroup = new THREE.Group();
      
      // Build a fluffy low-poly cloud out of random size boxes
      const numBlocks = 3 + Math.floor(Math.random() * 5);
      for (let j = 0; j < numBlocks; j++) {
        const sizeX = 1.2 + Math.random() * 2;
        const sizeY = 0.8 + Math.random() * 1.2;
        const sizeZ = 1 + Math.random() * 1.5;
        
        const blockGeom = new THREE.BoxGeometry(sizeX, sizeY, sizeZ);
        const block = new THREE.Mesh(blockGeom, cloudMat);
        
        // Random relative offsets
        block.position.set(
          (Math.random() - 0.5) * 1.5,
          (Math.random() - 0.5) * 0.6,
          (Math.random() - 0.5) * 1.2
        );
        cloudGroup.add(block);
      }
      
      // Positioning along flight corridor
      // X: scattered left/right (wider than camera view)
      // Y: scattered altitudes
      // Z: scattered depth
      const xSign = Math.random() > 0.5 ? 1 : -1;
      cloudGroup.position.set(
        (5 + Math.random() * 25) * xSign,
        (Math.random() - 0.5) * 15,
        -150 + Math.random() * 200
      );
      
      const scale = 0.6 + Math.random() * 1.5;
      cloudGroup.scale.set(scale, scale, scale);
      
      // Speed vector
      cloudGroup.userData = {
        speedZ: 0.5 + Math.random() * 0.8,
        wiggleSpeed: 0.005 + Math.random() * 0.01,
        wiggleOffset: Math.random() * 100
      };
      
      this.scene.add(cloudGroup);
      this.clouds.push(cloudGroup);
    }
  }
  
  createStars() {
    // Background Space dust / blinking stars
    const starCount = 300;
    const starGeom = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    
    for (let i = 0; i < starCount; i++) {
      // Sphere scattering at safe distance
      const radius = 250 + Math.random() * 150;
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      
      starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      starPositions[i * 3 + 2] = radius * Math.cos(phi);
    }
    
    starGeom.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.8,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.0
    });
    
    this.starPoints = new THREE.Points(starGeom, starMat);
    this.scene.add(this.starPoints);
  }
  
  createGates() {
    // Add glowing navigational neon rings representing checkpoints
    this.gates = [];
    const gateCount = 5;
    
    const ringGeom = new THREE.TorusGeometry(3.5, 0.08, 8, 24);
    
    for (let i = 0; i < gateCount; i++) {
      let color = 0x00ffff; // Cyan
      if (i === 1) color = 0xffa500; // Experience (Amber)
      if (i === 2) color = 0x00ffff; // Hangar (Cyan)
      if (i === 3) color = 0x00ffff; // Controls (Cyan)
      if (i === 4) color = 0x22c55e; // Arrival (Green)
      
      const ringMat = new THREE.MeshBasicMaterial({ 
        color: color, 
        transparent: true, 
        opacity: 0.35,
        wireframe: true
      });
      const gate = new THREE.Mesh(ringGeom, ringMat);
      
      // Position along the virtual scroll path
      // Gates will sit far apart in Z depth
      gate.position.set(0, 0, -40 * i);
      this.scene.add(gate);
      this.gates.push(gate);
    }
  }
  
  onWindowResize() {
    this.width = this.container.clientWidth;
    this.height = this.container.clientHeight;
    
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    
    this.renderer.setSize(this.width, this.height);
  }
  
  toggleGameMode(active) {
    this.gameActive = active;
    
    if (active) {
      this.gameScore = 0;
      this.gameEnergy = 100;
      
      // Stop body scrolling
      document.getElementById('scroll-main').style.overflowY = 'hidden';
      
      // Hide gates
      this.gates.forEach(g => g.visible = false);
      
      // Shift ambient sky to cosmic night
      gsap.to(this.scene.background, {
        r: 0.01, g: 0.02, b: 0.06, duration: 1.0
      });
      gsap.to(this.scene.fog, {
        color: 0x030610, duration: 1.0
      });
      this.ambientLight.color.setHex(0x1a2e4d);
      this.dirLight.color.setHex(0x00ffff);
      this.dirLight.intensity = 0.4;
      this.starPoints.material.opacity = 0.8;
      
      // Spawn golden target rings
      this.spawnGameRings();
    } else {
      // Re-enable scroller
      document.getElementById('scroll-main').style.overflowY = 'scroll';
      this.gates.forEach(g => g.visible = true);
      
      // Remove game rings
      this.gameRings.forEach(ring => this.scene.remove(ring));
      this.gameRings = [];
      
      // Trigger camera reset to current scroll coordinate
      const scrollMain = document.getElementById('scroll-main');
      const scrollPct = scrollMain.scrollTop / (scrollMain.scrollHeight - scrollMain.clientHeight);
      this.updateScroll(scrollPct);
    }
  }
  
  spawnGameRings() {
    this.gameRings.forEach(ring => this.scene.remove(ring));
    this.gameRings = [];
    
    const ringGeom = new THREE.TorusGeometry(1.6, 0.12, 8, 24);
    const ringMat = new THREE.MeshBasicMaterial({ 
      color: 0xffa500, // Golden amber rings
      transparent: true,
      opacity: 0.8,
      wireframe: true
    });
    
    // Spawn 5 rings at steps ahead
    const startZ = this.planeGroup.position.z - 30;
    for (let i = 0; i < 5; i++) {
      const ring = new THREE.Mesh(ringGeom, ringMat);
      ring.position.set(
        (Math.random() - 0.5) * 8, // X bounds
        (Math.random() - 0.5) * 4, // Y bounds
        startZ - i * 35            // Z spacing
      );
      
      ring.userData = {
        spinSpeed: 0.02 + Math.random() * 0.03
      };
      
      this.scene.add(ring);
      this.gameRings.push(ring);
    }
  }
  
  // Track scroll updates from main.js
  updateScroll(scrollPercentage) {
    if (this.gameActive) return; // Ignore scroll tracking in manual game flight
    
    this.scrollProgress = scrollPercentage;
    
    // Interpolate Sky atmosphere color & light values using GSAP
    let targetSkyColor, targetAmbientColor, targetDirColor, targetIntensity;
    
    if (scrollPercentage < 0.25) {
      // 1. Dawn (Home)
      const ratio = scrollPercentage / 0.25;
      targetSkyColor = new THREE.Color(this.colors.dawn.sky).lerp(new THREE.Color(this.colors.noon.sky), ratio);
      targetAmbientColor = new THREE.Color(this.colors.dawn.ambient).lerp(new THREE.Color(this.colors.noon.ambient), ratio);
      targetDirColor = new THREE.Color(this.colors.dawn.directional).lerp(new THREE.Color(this.colors.noon.directional), ratio);
      targetIntensity = 0.8 + ratio * 0.4;
      this.starPoints.material.opacity = 0.0;
    } 
    else if (scrollPercentage < 0.5) {
      // 2. High Noon (Experience)
      const ratio = (scrollPercentage - 0.25) / 0.25;
      targetSkyColor = new THREE.Color(this.colors.noon.sky).lerp(new THREE.Color(this.colors.sunset.sky), ratio);
      targetAmbientColor = new THREE.Color(this.colors.noon.ambient).lerp(new THREE.Color(this.colors.sunset.ambient), ratio);
      targetDirColor = new THREE.Color(this.colors.noon.directional).lerp(new THREE.Color(this.colors.sunset.directional), ratio);
      targetIntensity = 1.2 - ratio * 0.4;
      this.starPoints.material.opacity = 0.0;
    }
    else if (scrollPercentage < 0.75) {
      // 3. Sunset (Projects)
      const ratio = (scrollPercentage - 0.5) / 0.25;
      targetSkyColor = new THREE.Color(this.colors.sunset.sky).lerp(new THREE.Color(this.colors.night.sky), ratio);
      targetAmbientColor = new THREE.Color(this.colors.sunset.ambient).lerp(new THREE.Color(this.colors.night.ambient), ratio);
      targetDirColor = new THREE.Color(this.colors.sunset.directional).lerp(new THREE.Color(this.colors.night.directional), ratio);
      targetIntensity = 0.8 - ratio * 0.6;
      this.starPoints.material.opacity = ratio * 0.6;
    }
    else {
      // 4. Starry Cosmic Night (Controls & Arrival)
      targetSkyColor = new THREE.Color(this.colors.night.sky);
      targetAmbientColor = new THREE.Color(this.colors.night.ambient);
      targetDirColor = new THREE.Color(this.colors.night.directional);
      targetIntensity = 0.2;
      this.starPoints.material.opacity = 0.8;
    }
    
    // Set colors & light directly
    this.scene.background = targetSkyColor;
    this.scene.fog.color = targetSkyColor;
    this.ambientLight.color = targetAmbientColor;
    this.dirLight.color = targetDirColor;
    this.dirLight.intensity = targetIntensity;
    
    // Flight camera navigation transitions:
    // Move the camera and plane along a curving spiral trajectory through the gates!
    const zDepth = -160 * scrollPercentage;
    
    // Calculate curving target flight path coordinates
    const targetX = Math.sin(scrollPercentage * Math.PI * 2) * 5;
    const targetY = Math.cos(scrollPercentage * Math.PI * 1.5) * 2;
    
    // Animate flight camera orbits and look-at paths using GSAP lerps
    gsap.to(this.camera.position, {
      x: targetX,
      y: targetY + 2.2,
      z: zDepth + 10,
      duration: 1.2,
      ease: "power2.out",
      overwrite: "auto"
    });
    
    // Dynamic flight controls steer inputs (Plane pitches and rolls)
    this.planeTargetX = targetX;
    this.planeTargetY = targetY;
    
    // Jet stream vapor trail glow shifts
    if (this.jetLight) {
      this.jetLight.intensity = 1.0 + (scrollPercentage * 4);
    }
  }
  
  animate(timestamp) {
    requestAnimationFrame(this.animate.bind(this));
    
    const time = timestamp * 0.001 || 0;
    
    // 1. Slow cosmic background space rotation
    if (this.starPoints) {
      this.starPoints.rotation.y = time * 0.005;
      this.starPoints.rotation.x = time * 0.002;
    }
    
    // 2. Micro-turbulence wiggle inside the airplane cockpit
    let turbulenceX = Math.sin(time * 5.0) * 0.04;
    let turbulenceY = Math.cos(time * 6.0) * 0.04;
    
    // Plane steering calculations
    if (this.planeGroup) {
      if (this.gameActive) {
        // ================= MANUAL GAME MODE PHYSICS CONTROL LOOP =================
        let dx = 0;
        let dy = 0;
        if (this.keyboardInput.left) dx = -1;
        if (this.keyboardInput.right) dx = 1;
        if (this.keyboardInput.up) dy = 1;
        if (this.keyboardInput.down) dy = -1;
        
        // Translate coordinates
        const speedX = 0.16;
        const speedY = 0.12;
        this.planeGroup.position.x += dx * speedX;
        this.planeGroup.position.y += dy * speedY;
        
        // Flight simulation moving forward
        this.planeGroup.position.z -= 0.35;
        
        // Clamping constraints inside viewport bounds
        this.planeGroup.position.x = THREE.MathUtils.clamp(this.planeGroup.position.x, -8, 8);
        this.planeGroup.position.y = THREE.MathUtils.clamp(this.planeGroup.position.y, -3.5, 4.5);
        
        // Dynamic bank roll/pitch attitude rotations
        const targetRoll = -dx * 0.55;
        const targetPitch = dy * 0.3;
        this.planeGroup.rotation.z = THREE.MathUtils.lerp(this.planeGroup.rotation.z, targetRoll, 0.1);
        this.planeGroup.rotation.x = THREE.MathUtils.lerp(this.planeGroup.rotation.x, targetPitch, 0.1);
        this.planeGroup.rotation.y = THREE.MathUtils.lerp(this.planeGroup.rotation.y, dx * 0.25, 0.1);
        
        // Orbit camera following smoothly behind
        this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, this.planeGroup.position.x, 0.08);
        this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, this.planeGroup.position.y + 1.8, 0.08);
        this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, this.planeGroup.position.z + 8, 0.08);
        this.camera.lookAt(this.planeGroup.position.x, this.planeGroup.position.y - 0.5, this.planeGroup.position.z - 8);
        
        // Loop cloud coordinates relative to flight progress
        this.clouds.forEach(cloud => {
          if (cloud.position.z > this.planeGroup.position.z + 20) {
            cloud.position.z = this.planeGroup.position.z - 150;
            const xSign = Math.random() > 0.5 ? 1 : -1;
            cloud.position.x = (5 + Math.random() * 25) * xSign + this.planeGroup.position.x;
            cloud.position.y = (Math.random() - 0.5) * 15 + this.planeGroup.position.y;
          }
        });
        
        // Looping rings & Collision verification
        this.gameRings.forEach(ring => {
          ring.rotation.z += ring.userData.spinSpeed;
          
          // Re-spawn ring far ahead if plane flew past
          if (ring.position.z > this.planeGroup.position.z + 10) {
            ring.position.z = this.planeGroup.position.z - 150;
            ring.position.x = (Math.random() - 0.5) * 14;
            ring.position.y = (Math.random() - 0.5) * 7;
          }
          
          // Compute geometric distance
          const dist = this.planeGroup.position.distanceTo(ring.position);
          
          // Flight ring center passing check
          if (dist < 2.0) {
            this.gameScore += 10;
            this.gameEnergy = Math.min(this.gameEnergy + 15, 100);
            
            // Relocate ring far ahead
            ring.position.z = this.planeGroup.position.z - 150;
            ring.position.x = (Math.random() - 0.5) * 14;
            ring.position.y = (Math.random() - 0.5) * 7;
            
            // Invoke synthesized sound trigger
            if (this.onCollisionRing) {
              this.onCollisionRing();
            }
            
            // Callback to dashboard HUD
            if (this.onGameUpdate) {
              this.onGameUpdate({ score: this.gameScore, energy: Math.round(this.gameEnergy) });
            }
          }
        });
        
        // Energy consumption rate
        this.gameEnergy -= 0.06;
        if (this.gameEnergy <= 0) {
          this.gameEnergy = 0;
          if (this.onGameUpdate) {
            this.onGameUpdate({ score: this.gameScore, energy: 0, gameOver: true });
          }
        } else {
          if (this.onGameUpdate && Math.random() > 0.8) {
            this.onGameUpdate({ score: this.gameScore, energy: Math.round(this.gameEnergy) });
          }
        }
        
        // Vapor trail lines tracker
        if (this.trailLeft && this.trailRight) {
          this.trailPointsLeft.pop();
          this.trailPointsRight.pop();
          const leftTip = new THREE.Vector3(-1.92, 0, -0.72).applyMatrix4(this.planeGroup.matrixWorld);
          const rightTip = new THREE.Vector3(1.92, 0, -0.72).applyMatrix4(this.planeGroup.matrixWorld);
          this.trailPointsLeft.unshift(leftTip);
          this.trailPointsRight.unshift(rightTip);
          this.trailLeftGeometry.setFromPoints(this.trailPointsLeft);
          this.trailRightGeometry.setFromPoints(this.trailPointsRight);
          this.trailLeftGeometry.attributes.position.needsUpdate = true;
          this.trailRightGeometry.attributes.position.needsUpdate = true;
        }
        
      } else {
        // ================= AUTOPILOT DEFAULT SCROLL-LINKED RENDERING =================
        const currentPos = this.planeGroup.position;
        const targetZ = -160 * this.scrollProgress;
        
        const newX = THREE.MathUtils.lerp(currentPos.x, this.planeTargetX + turbulenceX, this.planeSpeed);
        const newY = THREE.MathUtils.lerp(currentPos.y, this.planeTargetY + turbulenceY, this.planeSpeed);
        const newZ = THREE.MathUtils.lerp(currentPos.z, targetZ, this.planeSpeed);
        
        const diffX = newX - currentPos.x;
        const diffY = newY - currentPos.y;
        
        const roll = -diffX * 4.0;  // Lateral banking
        const pitch = diffY * 2.0;  // Vertical elevator pitch
        
        this.planeGroup.position.set(newX, newY, newZ);
        
        this.planeGroup.rotation.z = THREE.MathUtils.lerp(this.planeGroup.rotation.z, roll, 0.1);
        this.planeGroup.rotation.x = THREE.MathUtils.lerp(this.planeGroup.rotation.x, pitch, 0.1);
        this.planeGroup.rotation.y = THREE.MathUtils.lerp(this.planeGroup.rotation.y, diffX * 1.5, 0.1);
        
        this.camera.lookAt(newX, newY - 0.5, newZ - 8);
        
        if (this.trailLeft && this.trailRight) {
          this.trailPointsLeft.pop();
          this.trailPointsRight.pop();
          const leftTip = new THREE.Vector3(-1.92, 0, -0.72).applyMatrix4(this.planeGroup.matrixWorld);
          const rightTip = new THREE.Vector3(1.92, 0, -0.72).applyMatrix4(this.planeGroup.matrixWorld);
          this.trailPointsLeft.unshift(leftTip);
          this.trailPointsRight.unshift(rightTip);
          this.trailLeftGeometry.setFromPoints(this.trailPointsLeft);
          this.trailRightGeometry.setFromPoints(this.trailPointsRight);
          this.trailLeftGeometry.attributes.position.needsUpdate = true;
          this.trailRightGeometry.attributes.position.needsUpdate = true;
        }
      }
    }
    
    // 4. Cloud particle floating simulation (always run)
    const baseSpeed = 0.15;
    const scrollInducedSpeed = Math.abs(this.planeTargetX - (this.planeGroup ? this.planeGroup.position.x : 0)) * 2;
    const finalSpeed = baseSpeed + scrollInducedSpeed;
    
    this.clouds.forEach(cloud => {
      cloud.position.z += cloud.userData.speedZ * finalSpeed * 2;
      const offset = cloud.userData.wiggleOffset;
      cloud.position.y += Math.sin(time + offset) * 0.005;
      
      if (this.planeGroup && cloud.position.z > this.planeGroup.position.z + 20) {
        cloud.position.z = this.planeGroup.position.z - 150;
        const xSign = Math.random() > 0.5 ? 1 : -1;
        cloud.position.x = (5 + Math.random() * 25) * xSign + (this.planeGroup ? this.planeGroup.position.x : 0);
        cloud.position.y = (Math.random() - 0.5) * 15 + (this.planeGroup ? this.planeGroup.position.y : 0);
      }
    });
    
    // 5. Gate rotations (only spin when game is off)
    if (!this.gameActive) {
      this.gates.forEach((gate, idx) => {
        gate.rotation.z = time * (0.05 + idx * 0.02);
      });
    }
    
    this.renderer.render(this.scene, this.camera);
  }
}
