# COMPREHENSIVE PROMPT: RECREATE SONIC THE HEDGEHOG (1991) FROM SCRATCH

## CRITICAL INSTRUCTIONS FOR AI IMPLEMENTATION

You are tasked with creating a faithful recreation of the original Sonic the Hedgehog (1991) video game from scratch. This is not a simplified version - this must be a fully functional, playable game that captures the essence, mechanics, physics, and feel of the original Sega Genesis masterpiece. Before writing any code, you MUST research the actual game mechanics, physics system, level design principles, and visual style from the original 1991 Sonic the Hedgehog game.

## RESEARCH REQUIREMENTS (MANDATORY BEFORE CODING)

Before implementing anything, you must understand:

1. **Sonic's Physics Engine**: Research the exact physics system used in the original game, including:
   - Ground movement physics (acceleration, deceleration, friction)
   - Air movement physics (jump mechanics, air resistance)
   - Slope physics and momentum transfer
   - Rolling mechanics and speed retention
   - The infamous "slope bug" and how momentum works on curves
   - How Sonic's speed affects animation frame rates

2. **Level Design Philosophy**: Study Green Hill Zone Act 1 specifically:
   - Multiple route design (upper route, middle route, lower route)
   - How skilled players are rewarded with faster, higher routes
   - Platform placement and spacing
   - Enemy placement and patterns
   - Ring placement strategy
   - Spring and speed boost placement
   - Loop-de-loop mechanics and requirements
   - Tunnel and bridge sections

3. **Visual Style and Animation**: Research the exact sprite work:
   - Sonic's animation cycles (idle, walking, running, rolling, jumping, skidding)
   - How animation speed increases with velocity
   - Background parallax scrolling layers
   - Foreground and background element separation
   - Color palette of Green Hill Zone
   - Water effects and transparency
   - Visual feedback systems (ring loss, invincibility, etc.)

4. **Game Systems**: Understand the core mechanics:
   - Ring collection and loss system
   - Score calculation and bonus points
   - Invincibility item and super speed item effects
   - Shield mechanics
   - Extra life collection
   - Checkpoint system
   - Time counting system
   - The exact collision detection system used

## IMPLEMENTATION SPECIFICATIONS

### TECHNOLOGY STACK

**Primary Recommendation: HTML5 Canvas with Vanilla JavaScript**

Rationale:
- HTML5 Canvas provides pixel-perfect control needed for retro game recreation
- No framework overhead means better performance for complex physics calculations
- Direct control over rendering pipeline for authentic retro effects
- Easy to deploy and share (single HTML file possible)
- Native 60 FPS game loop support
- Excellent for 2D sprite-based games

**Alternative Options (if you determine they're superior for specific reasons):**
- Python with Pygame (better for prototyping physics, but requires local installation)
- Java with LibGDX (if cross-platform desktop deployment is priority)
- JavaScript with Phaser 3 framework (if you need built-in physics but want to customize heavily)

**Your choice must be justified based on**: ease of deployment, physics precision, performance, and ability to add features incrementally.

### PROJECT STRUCTURE REQUIREMENTS

The codebase MUST be structured for easy expansion. Create a modular architecture:

```
Core Systems (Implement First):
├── GameEngine (main game loop, timing, state management)
├── PhysicsEngine (collision detection, velocity, acceleration)
├── InputHandler (keyboard/touch controls with buffering)
├── Renderer (canvas rendering, camera system, parallax)
├── AssetManager (sprite loading, sound management)
└── MathUtils (vector math, collision helpers)

Game Objects (Implement Second):
├── Player (Sonic character with full physics)
├── Terrain (platforms, slopes, collision tiles)
├── Collectibles (rings, monitors, power-ups)
├── Enemies (badniks with AI patterns)
├── Hazards (spikes, pits, crushing obstacles)
└── Interactives (springs, loops, speed boosters)

Level System (Implement Third):
├── LevelLoader (tile map parsing and loading)
├── TileEngine (rendering and collision for tile-based terrain)
├── RouteSystem (multiple path tracking)
├── CheckpointManager (save state system)
└── LevelGoal (signpost, score tally)

UI Systems (Implement Fourth):
├── HUD (score, rings, time display)
├── TitleScreen (game start menu)
├── PauseMenu (pause functionality)
└── GameOver (death and game over screens)
```

### SONIC'S PHYSICS ENGINE - DETAILED SPECIFICATIONS

This is the heart of the game. Implement with extreme precision:

#### GROUND MOVEMENT PHYSICS

**Walking/Running (Ground Sensor Active)**

```
Constants (adjust through testing to match original feel):
- ACCELERATION = 0.046875 pixels/frame² (when running)
- DECELERATION = 0.5 pixels/frame² (when not pressing directions)
- FRICTION = 0.046875 pixels/frame² (applied each frame)
- TOP_SPEED = 6 pixels/frame (normal maximum speed)
- MAX_SPEED_ROLLING = 16 pixels/frame (when rolling downhill)

Ground Movement Algorithm:
1. If LEFT or RIGHT pressed:
   - If moving in same direction: velocity += ACCELERATION
   - If moving opposite direction: velocity -= DECELERATION (skidding)
   - Clamp velocity to ±TOP_SPEED

2. If no direction pressed:
   - Apply FRICTION: velocity *= (1 - FRICTION)
   - If abs(velocity) < 0.05: velocity = 0 (stop completely)

3. Apply ground angle:
   - If on slope: velocity += sin(slope_angle) * GRAVITY * 0.125
   - This creates realistic downhill acceleration and uphill slowing

4. Update position:
   - position.x += velocity
   - Keep Sonic attached to ground with raycasting
```

**Slope Physics (CRITICAL FOR AUTHENTIC FEEL)**

```
Ground Angle Detection:
- Cast ray downward from Sonic's position
- Detect collision with terrain
- Calculate angle of terrain surface
- Store as current_ground_angle

Slope Influence on Movement:
- ground_velocity += sin(ground_angle) * SLOPE_FACTOR
- SLOPE_FACTOR = 0.125 for rolling, 0.078125 for running
- This creates momentum gain on downslopes
- Creates momentum loss on upslopes
- Makes loop-de-loops possible with sufficient speed

Slope Transition:
- When ground_angle changes rapidly (corners):
  - Preserve momentum magnitude
  - Redirect velocity vector along new slope
  - This creates the "flow" feeling of Sonic gameplay
```

#### AIR MOVEMENT PHYSICS

**Jumping Mechanics**

```
Jump Initiation:
- If JUMP pressed and grounded:
  - Set velocity.y = -6.5 (jump velocity)
  - Set grounded = false
  - Play jump animation
  - Play jump sound

Variable Jump Height:
- If JUMP released before apex:
  - velocity.y *= 0.5 (cut jump short)
  - This allows for precise platforming

Air Control:
- AIR_ACCELERATION = 0.09375 (double ground acceleration)
- Player can influence horizontal velocity in air
- Cannot exceed TOP_SPEED in normal air movement
- Can maintain speeds above TOP_SPEED if gained from slopes
```

**Gravity and Falling**

```
Constants:
- GRAVITY = 0.21875 pixels/frame²
- TERMINAL_VELOCITY = 16 pixels/frame (maximum fall speed)

Every Frame While Airborne:
1. velocity.y += GRAVITY
2. If velocity.y > TERMINAL_VELOCITY: velocity.y = TERMINAL_VELOCITY
3. Apply air control based on input
4. position.x += velocity.x
5. position.y += velocity.y
6. Check for ground collision
```

#### ROLLING PHYSICS

**Entering Roll State**

```
Roll Activation:
- If grounded AND moving AND DOWN pressed:
  - Enter roll state
  - Change hitbox (shorter, wider)
  - Change animation to spin
  - ACCELERATION = 0 (cannot accelerate while rolling)
  - Can only maintain or lose speed

Rolling Deceleration:
- ROLL_FRICTION = 0.0234375 (half of normal friction)
- ROLL_DECELERATION = 0.125 (when on flat ground)
- velocity -= ROLL_DECELERATION each frame
- If velocity < 0.5: exit roll state (stand up)

Rolling on Slopes:
- DOWN slopes: velocity += sin(angle) * 0.1875
  - Rolls accelerate downhill (can exceed TOP_SPEED)
  - This is KEY for building speed
- UP slopes: velocity -= sin(angle) * 0.3125
  - Rolls decelerate uphill
  - May stop completely on steep hills

Exiting Roll:
- If velocity < 0.5: automatically stand up
- If JUMP pressed: jump from roll (maintains velocity)
- Cannot manually exit roll while moving fast
```

#### COLLISION DETECTION SYSTEM

**Sonic's Hitboxes (MUST BE ACCURATE)**

```
Standing Hitbox:
- Width: 20 pixels (9 pixels offset)
- Height: 40 pixels (standard)
- Pivot point: center-bottom

Rolling/Jumping Hitbox:
- Width: 30 pixels (14 pixels offset)
- Height: 30 pixels (smaller profile)
- Pivot point: center

Sensor System (Raycasting):
Ground Sensors:
- Cast 2 rays downward from feet (left side and right side)
- Ray length: 20 pixels
- If either ray hits: grounded = true
- Calculate ground angle from hit surface
- Attach Sonic to surface at correct height

Wall Sensors:
- Cast rays horizontally at 3 heights (top, middle, bottom)
- Detect walls and obstacles
- Push Sonic out of walls with minimum translation vector
- If moving fast into wall: lose rings, play hit sound

Ceiling Sensors:
- Cast rays upward when jumping
- Detect ceiling collision
- If hit: velocity.y = 0, cancel upward movement
- Important for tunnel sections
```

**Terrain Collision**

```
Tile-Based Collision System:
- Divide level into 32x32 pixel tiles (or 16x16 for precision)
- Each tile has collision type:
  - SOLID (blocks all movement)
  - PLATFORM (can jump through from below, solid from above)
  - SLOPE_TYPE_1 through SLOPE_TYPE_16 (different angles)
  - HAZARD (spikes, instant damage)
  - NONE (empty space)

Slope Tile Types:
- 45° slope right-up: ◢
- 45° slope left-up: ◣
- 22.5° slope gradual right-up (two tiles)
- 22.5° slope gradual left-up (two tiles)
- Convex curves for hills
- Concave curves for valleys

Pixel-Perfect Collision:
- For each tile in collision range:
  - If tile is SOLID: use AABB collision
  - If tile is SLOPE: raycast to find exact height
  - If tile is PLATFORM: only collide if moving downward
  - Resolve collision by moving Sonic to surface
```

#### SPECIAL MOVEMENT MECHANICS

**Loop-De-Loop Physics**

```
Loop Requirements:
- Minimum entry speed: 4.0 pixels/frame
- If entering loop with sufficient speed:
  - Switch to "loop mode" - Sonic follows curve path
  - Gravity direction rotates to follow loop
  - Player maintains control but limited
  - If speed drops below 2.0 mid-loop: fall off loop

Loop Path Following:
- Predefine loop path as series of points
- Interpolate Sonic's position along path
- Rotate Sonic sprite to match tangent
- Apply centrifugal force simulation
- Exit loop when path complete
```

**Spring Bouncing**

```
Spring Types:
1. Yellow Spring (medium bounce): velocity.y = -7.0
2. Red Spring (high bounce): velocity.y = -10.0
3. Horizontal Springs: velocity.x = ±8.0

Spring Behavior:
- Override current velocity with spring velocity
- Play spring animation
- Play spring sound
- Brief control lock (0.1 seconds)
- Spring animates compress/decompress
```

**Speed Boost Sections**

```
Speed Booster Tiles:
- When Sonic enters: velocity.x = 12.0
- Override player control temporarily
- Sonic enters "dash" animation
- Camera speeds up to follow
- Often leads into loops or jumps
```

### LEVEL DESIGN - GREEN HILL ZONE ACT 1

#### MULTIPLE ROUTE SYSTEM

**Route Philosophy**: The original Sonic games reward skill with speed. Better players discover and can navigate faster, higher routes.

**Upper Route** (Expert Path):
```
Design Characteristics:
- Highest elevation in level
- Requires precise jumping and momentum management
- Fewer enemies and obstacles
- More rings and 1-up opportunities
- Speed boosters and spring chains
- Risk: fall from upper route = lose time advantage
- Reward: fastest completion time, 10,000 point time bonus

Example Upper Route Section:
[Start] -> Spring Launch -> Platform Chain (jumping required) 
-> Speed Booster -> Loop-de-loop -> Spring -> Upper Platform Network
-> Ring Trail -> Another Speed Booster -> [Continue]

Implementation:
- Platforms spaced 80-100 pixels apart vertically
- Require jump + forward momentum to reach
- Include springs that only activate with high speed
- Place rings as "breadcrumbs" showing the path
```

**Middle Route** (Standard Path):
```
Design Characteristics:
- Default path for most players
- Balanced challenge and reward
- Mix of platforming and speed sections
- Moderate enemy placement
- Some rings and power-ups
- Most straightforward path

Example Middle Route Section:
[Start] -> Slight slope down -> Enemy (Motobug) -> Platform hop
-> Bridge section -> Spring to next area -> Slope with rings
-> Enemy (Newtron) -> Platform -> [Continue]

Implementation:
- Clear visual path forward
- Gentle learning curve
- Introduces mechanics gradually
- Safe but not fastest route
```

**Lower Route** (Beginner/Punishment Path):
```
Design Characteristics:
- Lowest elevation, often underground/underwater
- Slowest route (more obstacles)
- More enemies and hazards
- Risk of drowning if water is present
- Fewer rings
- Easier platforming but time-consuming

Example Lower Route Section:
[Fall from above] -> Underground tunnel -> Moving platforms
-> Spikes to avoid -> Crumbling platforms -> Enemy (Crabmeat)
-> Spring to return to middle route -> [Continue]

Implementation:
- Players fall here by missing jumps
- Punishment through time loss, not death
- Always provide way back up to main routes
- More claustrophobic, enclosed spaces
```

#### GREEN HILL ZONE ACT 1 - COMPLETE LAYOUT

**Section 1: Opening (0-500 pixels)**
```
Tutorial section introducing basic mechanics:

Terrain:
- Flat ground start
- Gentle downward slope (10°)
- Small upward hill (15°)
- First platform gap (60 pixels wide, easy jump)

Enemies:
- 1 Motobug (basic ground enemy) at x=250
  - Patrols 100 pixel range
  - Defeated by jump or roll

Collectibles:
- Ring line (6 rings) showing forward path at x=150
- Monitor with 10 rings at x=350 on small platform
- Ring trail (8 rings) leading up small hill

Design Purpose:
- Teach players to run, jump, collect rings
- Introduce basic enemy without danger
- Show ring monitor system
- Establish forward momentum
```

**Section 2: First Branch Point (500-1200 pixels)**
```
Path splits into upper and lower routes:

UPPER ROUTE:
- Spring at x=520 (requires running start to reach)
- Launches to high platform at y=-150 (screen height)
- Platform chain: 4 platforms, 80 pixels apart
- Speed booster at end leading to...
- First loop-de-loop (requires 4.0 speed)
- Enemy: Buzz Bomber at x=900 (flying, shoots projectile)
- Ring bonus: 15 rings in trail after loop

LOWER ROUTE (default):
- Continue on ground level
- Bridge section (wooden texture)
- 2 Motobugs patrolling
- Underground tunnel entrance
- 10 rings in tunnel
- Crabmeat enemy (shoots projectiles when approached)
- Spring at tunnel exit to rejoin middle route

Implementation:
- Upper route saves ~3 seconds if executed well
- Lower route is safer but slower
- Both routes converge at x=1200
```

**Section 3: Water Section (1200-2000 pixels)**
```
Visual change: water level rises creating blue tint

Upper Platform Route:
- Series of moving platforms above water
- 12 platforms, moving horizontally (60 pixels range)
- Air bubbles indicate underwater hazard
- Rings placed to guide platform timing

Water Floor Route:
- Sonic can walk underwater (slowed movement)
- Must collect air bubbles every 10 seconds
- Air countdown timer appears at 5 seconds
- Drowning music plays if no air collected
- Spikes on underwater floor as hazards

Middle Route (Floating Platforms):
- Bridge platforms at water surface level
- Mix of solid and falling platforms
- Newtron enemy (shoots ground projectile)
- Shield monitor as reward for difficult jump

Implementation:
- Water physics: velocity *= 0.5 when submerged
- Jump velocity *= 0.5 underwater
- Air bubble system critical to avoid drowning death
- Visual effects: wavy water surface, darker tint
```

**Section 4: Loop Gauntlet (2000-3000 pixels)**
```
Series of speed-testing obstacles:

Route Design:
- Long downward slope (30°) for speed building
- First full loop-de-loop (requires 5.0 speed minimum)
- Speed booster after first loop
- Second loop (faster, tighter)
- Corkscrew section (3D spiral effect)

Obstacles:
- Spikes at base of slopes (punish slow players)
- Buzz Bombers flying figure-8 pattern
- Collapsing bridges if moving too slowly

Power-Ups:
- Invincibility monitor at start of section
- Speed shoes monitor on high platform (skilled jump needed)
- 1-up monitor after completing both loops perfectly

Implementation:
- Speed checking at loop entrances
- If too slow: Sonic falls through center
- Falling through = lower route punishment
- Visual: background rotates during loops
```

**Section 5: Vertical Tower (3000-3500 pixels)**
```
Climb upward through multi-tiered section:

Level 1 (Ground):
- Spring network launching upward
- Motobug enemies on small platforms
- Checkpoint marker (lamppost)

Level 2 (Mid-height):
- Platform jumping required
- Buzz Bomber patrol pattern
- Ring bonus (20 rings in arrow shape)

Level 3 (Upper):
- Narrow platforms requiring precision
- Crabmeat on each platform
- Speed booster on top leading to...

Peak:
- High-altitude overlook
- Giant ring for Special Stage (if 50+ rings)
- Forward spring launching to next section

Alternative: Tunnel Route
- Side entrance at ground level
- Bypasses tower climbing
- Slower but safer
- Emerges at middle section of tower

Implementation:
- Vertical camera following
- Challenge: climb fast vs. collect rings
- Giant ring = bonus stage access (implement later)
```

**Section 6: Final Sprint (3500-4500 pixels)**
```
Fast downhill run to goal:

Upper Route:
- Extended slope (45°) for maximum speed
- Speed boosters every 300 pixels
- No enemies (reward for reaching upper route)
- Ring bonus trail (50 rings)
- Direct path to goal

Middle Route:
- Series of hills (up and down)
- Must maintain momentum
- 3 Motobugs spread out
- Platform hopping section
- Leads to goal with slight uphill

Lower Route:
- Tunnel system underground
- More enemy dense
- Moving platforms required
- Spike hazards
- Slowest approach to goal

Goal Post Section:
- Signpost at x=4500
- Sonic runs past, signpost spins showing his face
- Score tally screen
- Time bonus: <30 sec = 50,000, <45 sec = 10,000, <60 sec = 5,000
- Ring bonus: rings x 100
- Perfect bonus: 0 hits taken = 10,000
```

#### LEVEL ASSET SPECIFICATIONS

**Terrain Tile Set (Green Hill Zone)**
```
Ground Tiles:
- Grass top with brown/orange checkered underside
- 45° slope tiles (8 variations)
- 22.5° gentle slope tiles (16 variations)
- Platform tiles (can jump through from below)
- Bridge wooden tiles (different texture)
- Underground dirt tiles (darker palette)

Decorative Elements:
- Palm trees (parallax layer, no collision)
- Sunflowers (animated, sway gently)
- Water surface (animated wave pattern)
- Clouds (moving slowly on background layer)
- Totem poles (background decoration)
- Rock formations

Implementation:
- Create tile atlas: 512x512 pixel sprite sheet
- Each tile: 32x32 pixels
- Include collision masks for each tile type
- Animated tiles: 4-8 frame loops
```

**Visual Layers (Parallax Scrolling)**
```
Layer 1 (Far Background):
- Sky with clouds
- Scroll speed: 0.1x camera speed
- Mountains in distance
- Color: bright blue sky (#8CB4FF)

Layer 2 (Mid Background):
- Hills and palm trees
- Scroll speed: 0.3x camera speed
- Adds depth perception

Layer 3 (Near Background):
- Flowers and foreground trees
- Scroll speed: 0.7x camera speed

Layer 4 (Game Layer):
- Actual playable terrain
- Scroll speed: 1.0x camera speed
- Sonic and all game objects

Layer 5 (Foreground):
- Hanging vines, flowers
- Scroll speed: 1.2x camera speed
- Creates depth (in front of Sonic)

Implementation:
- Render layers back-to-front
- Update scroll position based on camera
- Use separate canvas layers for performance
```

### ENEMY SPECIFICATIONS

#### MOTOBUG (Ground Enemy)
```
Appearance:
- Ladybug-like badnik
- Red shell with black spots
- Moves on tank treads
- Size: 32x32 pixels

Behavior AI:
1. Patrol mode (default):
   - Move forward at constant speed (1.0 pixels/frame)
   - If reaching ledge: turn around 180°
   - If hitting wall: turn around 180°
   - No vertical movement (ground-bound)

2. Detection:
   - No active player detection
   - Continues patrol regardless of Sonic

3. Defeat conditions:
   - Jump on top (from above): destroy, award 100 points
   - Roll into while moving: destroy, award 100 points
   - If Sonic touches from side/below: Sonic takes damage

4. Visual feedback:
   - Treads animate while moving (4 frame cycle)
   - On defeat: explosion animation (6 frames)
   - Animal emerges: flicky bird flies upward
   - Play destruction sound

Implementation:
- Simple state machine (Patrol, Turning, Destroyed)
- Box collision detection (32x32)
- Spawn rate: every 400-600 pixels in ground sections
```

#### BUZZ BOMBER (Flying Enemy)
```
Appearance:
- Robotic bee badnik
- Hovers in air with propeller
- Can shoot projectiles
- Size: 36x36 pixels

Behavior AI:
1. Flight pattern:
   - Hover in sine wave pattern vertically (amplitude: 50 pixels)
   - Move slowly horizontally (0.5 pixels/frame)
   - Maintains set height from ground

2. Attack behavior:
   - If Sonic within 200 pixels horizontally:
     - Stop moving
     - Face Sonic's direction
     - Wait 1 second
     - Shoot fireball projectile
     - Cooldown 3 seconds before next shot

3. Projectile:
   - Speed: 3.0 pixels/frame toward Sonic's position
   - Travels in straight line
   - Deals damage on contact
   - Destroys on hitting terrain
   - Lifetime: 3 seconds

4. Defeat conditions:
   - Same as Motobug
   - Awards 100 points

Implementation:
- State machine: Idle, Aiming, Shooting, Cooldown
- Projectile pool system (max 10 active)
- Raycast for projectile collision
- Spawn in elevated areas, platforms
```

#### CRABMEAT (Ranged Ground Enemy)
```
Appearance:
- Crab-like badnik
- Blue shell with red claws
- Size: 40x40 pixels
- More threatening design

Behavior AI:
1. Patrol mode:
   - Slower movement (0.7 pixels/frame)
   - Stops when reaching patrol boundary

2. Combat behavior:
   - If Sonic approaches within 150 pixels:
     - Stop moving
     - Raise claws
     - Shoot 2 projectiles at 30° angles (left and right)
     - Wait 2 seconds
     - Resume patrol

3. Projectiles:
   - Arc trajectory (parabolic motion)
   - Initial velocity: 4.0 pixels/frame
   - Affected by gravity
   - Bounce once off ground
   - Destroys after 2 bounces

4. Defeat conditions:
   - Must jump on back (top surface only)
   - Rolling into front claws: Sonic takes damage
   - Awards 100 points on defeat

Implementation:
- Directional collision (front vs. top)
- Projectile physics (velocity + gravity)
- Animation states: Walking, Stopped, Attacking
- Spawn near hazards and difficult jumps
```

#### NEWTRON (Unique Enemy)
```
Appearance:
- Dragonfly badnik
- Green body with transparent wings
- Can be disguised as plant
- Size: 32x48 pixels (tall)

Behavior AI:
1. Camouflage mode:
   - Appears as decorative plant
   - Stationary until Sonic approaches

2. Activation:
   - When Sonic within 100 pixels:
     - Transform animation (1 second)
     - Reveal true form
     - Begin hovering

3. Attack pattern:
   - Hover vertically above ground (150 pixels)
   - Fire green laser straight down
   - Laser: instant hit, visible beam
   - Cooldown: 4 seconds between shots
   - Dangerous but predictable

4. Movement:
   - After shooting, fly toward Sonic slowly
   - Can change horizontal position
   - Maintains vertical height

5. Defeat conditions:
   - Jump attack only (hard to reach)
   - Awards 200 points (higher value)

Implementation:
- State machine: Hidden, Transforming, Active, Attacking
- Laser is instant raycast (no projectile travel)
- Requires timing to jump and hit
- Placed in cramped areas for challenge
```

### COLLECTIBLES AND POWER-UPS

#### RINGS (Core Collection Mechanic)
```
Purpose: Health and score system

Behavior:
- Static rings: placed in level, spin animation (8 frames)
- Animate at 10 FPS (frame duration: 100ms)
- Collision radius: 16 pixels from center
- On collection:
  - Ring counter increases (+1)
  - Play ring sound (high-pitched chime)
  - Visual: sparkle effect (4 frame animation)
  - Score increases (+10 points)

Lost Rings (When Hit):
- On taking damage, Sonic loses ALL rings
- Rings scatter in random directions
- Each ring: initial velocity random (2-5 pixels/frame)
- Affected by gravity (fall downward)
- Bounce once off ground (velocity *= -0.6)
- Flash warning (blink) for 1 second
- Can be recollected for 3 seconds
- After 3 seconds: disappear
- Only recover ~50% of lost rings (difficult to collect all)

Ring Counter Display:
- Location: Top-left HUD
- Format: "RINGS: XXX"
- If 0 rings when hit: Sonic dies
- At 100 rings: gain 1-up, counter resets to 0
- At 200 rings: gain another 1-up

Strategic Importance:
- Rings act as health buffer (die in 1 hit without rings)
- Encourage risky play (collecting more rings)
- Risk/reward balance (harder routes have more rings)

Implementation:
- Ring object pool (up to 200 active rings)
- Spatial hashing for collision optimization
- Separate pools for level rings and lost rings
```

#### ITEM MONITORS (TV Boxes)
```
Appearance:
- CRT television-style box
- Icon shows contents on screen
- Size: 32x32 pixels
- Sits on ground or platforms

Types:

1. RING MONITOR (10 Rings):
   - Icon: Gold ring on screen
   - On break: instantly gain 10 rings
   - Common placement (every 500 pixels average)

2. SHIELD MONITOR (Blue Shield):
   - Icon: Blue bubble shield
   - On break: Sonic gains blue shield aura
   - Effect: survive 1 hit without losing rings
   - Shield disappears after 1 hit
   - Visual: rotating shield sprites around Sonic
   - Cannot stack (only 1 shield at a time)

3. INVINCIBILITY MONITOR (Stars):
   - Icon: Sparkling stars
   - On break: Sonic becomes invincible
   - Duration: 20 seconds
   - Visual effects:
     - Rainbow sparkles around Sonic
     - Star trail behind movement
     - Special invincibility music plays
   - Effects:
     - Cannot take damage
     - Enemies destroyed on contact
     - Can run through hazards
   - Timer counts down, returns to normal

4. SPEED SHOES MONITOR (Red Shoes):
   - Icon: Red sneaker
   - On break: Sonic gains speed boost
   - Duration: 20 seconds
   - Effects:
     - TOP_SPEED doubles (6 -> 12 pixels/frame)
     - ACCELERATION doubles
     - Music tempo increases
     - Super peel-out effect when starting
   - Movement feels more responsive

5. EXTRA LIFE MONITOR (Sonic Icon):
   - Icon: Sonic's face
   - On break: gain 1-up (extra life)
   - Rare placement (2-3 per level)
   - Usually in secret or hard-to-reach areas
   - Play 1-up jingle

Breaking Monitors:
- Methods:
  - Jump from below (most common)
  - Roll into from side
  - Jump and land on top
- Animation:
  - Monitor pops open (2 frames)
  - Contents fly out upward
  - Contents fly to Sonic position
  - Monitor becomes empty shell
- Sound effect: breaking glass/electronic pop

Implementation:
- Monitor state: Intact, Breaking, Broken
- Each type: different effect function
- Power-up timer system for timed items
- Visual effects overlay on Sonic sprite
```

#### SPECIAL COLLECTIBLES

**GIANT RING (Special Stage Access)**
```
Appearance:
- Large golden ring (64x64 pixels)
- Rotates in 3D effect
- Sparkles continuously
- Placed at checkpoints

Requirements:
- Must have 50+ rings to enter
- Hidden in upper routes usually
- Only 1-2 per level

Behavior:
- When Sonic has 50+ rings:
  - Giant ring visible and active
  - Glowing effect intensifies
  - On contact: warp to Special Stage
- When Sonic has <50 rings:
  - Giant ring appears but is greyed out
  - Cannot enter (pass through)

Implementation:
- Check ring count on collision
- If valid: trigger Special Stage transition
  - Screen flash effect
  - Spiral warp animation
  - Load Special Stage (implement in phase 2)
- Special Stage: rotating maze, collect Chaos Emerald
```

**CHECKPOINT LAMPPOST**
```
Appearance:
- Striped lamppost with star on top
- Red before activation, turns blue when passed
- Height: 48 pixels

Behavior:
- When Sonic passes (contact or proximity):
  - Lamppost spins 360° animation
  - Color changes red -> blue
  - Play checkpoint sound (chime)
  - Game state saved:
    - Sonic's position
    - Ring count
    - Score
    - Time (continues from checkpoint)
    - Power-up states

Death and Respawn:
- If Sonic dies:
  - If checkpoint activated: respawn at checkpoint
  - If no checkpoint: restart from level beginning
  - Lose all rings and power-ups
  - Time continues counting

Placement:
- Every 1000-1500 pixels
- Always on safe, flat ground
- Never near hazards or enemies

Implementation:
- State: Inactive, Active, Passed
- Save game state to variable
- Respawn system loads saved state
- Visual: rotation animation (16 frames)
```

### HAZARDS AND OBSTACLES

#### SPIKES (Static Hazard)
```
Appearance:
- Metal spikes protruding upward
- Gray/silver color
- 32 pixels wide x 16 pixels tall
- Can be floor, ceiling, or wall-mounted

Behavior:
- Static hazard (no movement)
- Instant damage on contact from any direction
- Even with shield: lose shield and rings
- No invincibility period (can hit multiple times rapidly)

Damage Effect:
- Sonic bounces backward (velocity = -4)
- Rings scatter
- Play hurt sound
- Brief invincibility frames (1 second)

Placement Strategy:
- Bottom of pits (punish fall mistakes)
- End of speed sections (test reaction time)
- Near springs (require precise timing)
- Under low platforms (test ducking)

Visual Feedback:
- Some spikes retract periodically (advanced)
- Timing: extend/retract every 2 seconds
- Warning: spikes shake before extending

Implementation:
- Collision box: precise to visible spikes
- Different orientations (0°, 90°, 180°, 270°)
- Animated types: state machine (Retracted, Warning, Extended)
```

#### CRUMBLING PLATFORMS
```
Appearance:
- Wooden or stone platform
- Cracks visible on surface
- Size: 64 pixels wide x 16 pixels tall

Behavior:
1. Stable state:
   - Acts like normal platform
   - Can stand on safely

2. Triggered state (when Sonic lands on it):
   - Wait 0.5 seconds (warning shake)
   - Shake animation (vibrate 2 pixels)
   - Begin crumbling

3. Crumbling state:
   - Platform breaks into 4 pieces
   - Pieces fall downward with gravity
   - Pieces disappear after 2 seconds
   - Platform gone (no collision)

4. Respawn:
   - After 5 seconds off-screen
   - Fade-in animation
   - Returns to stable state

Strategy:
- Requires quick movement
- Cannot stand still
- Tests player reflexes
- Often placed in series (platform gauntlet)

Implementation:
- State machine: Stable, Warning, Crumbling, Gone, Respawning
- Break into 4 sub-objects with physics
- Collision disabled during crumbling
- Timer-based respawn system
```

#### MOVING PLATFORMS
```
Types:

1. Horizontal Movers:
   - Move left-right on fixed path
   - Speed: 1.5 pixels/frame
   - Distance: 100-150 pixels
   - Constant speed (no acceleration)

2. Vertical Movers:
   - Move up-down on fixed path
   - Speed: 1.0 pixels/frame
   - Distance: 80-120 pixels
   - Often over pits or hazards

3. Circular Movers:
   - Rotate around central point
   - Radius: 80 pixels
   - Angular speed: 2° per frame
   - Chain of 3-4 platforms common

4. Disappearing Platforms:
   - Alternate: visible/invisible
   - Pattern: 2 seconds on, 2 seconds off
   - Warning: flash before disappearing

Platform Physics:
- When standing on moving platform:
  - Sonic's velocity += platform velocity
  - Sonic moves with platform
  - Preserve player input control
- When platform moves away:
  - Sonic maintains momentum briefly
  - Smoothly transition to air physics

Implementation:
- Platform carries player (no parenting needed)
- Path system: waypoint nodes
- Interpolate between waypoints
- Sine wave for smooth circular motion
```

### CAMERA SYSTEM

#### CAMERA BEHAVIOR
```
Follow Algorithm:
- Camera focuses on Sonic with smart following
- Not 1:1 locked (allows Sonic to move within frame)

Horizontal Scrolling:
- Dead zone: 60 pixels left/right of center
- When Sonic moves beyond dead zone:
  - Camera lerps toward Sonic
  - Lerp speed: 0.1 (smooth following)
  - Camera never goes ahead of Sonic
- When moving at high speed (velocity > 8):
  - Increase dead zone to 100 pixels
  - Look-ahead: camera leads slightly (+20 pixels in direction of movement)

Vertical Scrolling:
- Larger dead zone: 80 pixels up/down from center
- When jumping:
  - Camera lerps upward slowly
  - Priority: keep ground visible
- When falling:
  - Camera lerps downward faster
  - Helps player see landing area

Camera Bounds:
- Never scroll past level boundaries
- Left bound: x = 0
- Right bound: x = level_width - screen_width
- Top bound: y = 0
- Bottom bound: y = level_height - screen_height

Special Camera Modes:

1. Boss Camera:
   - Lock camera in fixed arena
   - Center on boss fight area
   - Sonic can move within bounds

2. Vertical Section Camera:
   - Priority: vertical following
   - Tighter horizontal dead zone
   - Used for tower climbing sections

3. Loop Camera:
   - Slow vertical movement during loops
   - Keeps loop visible
   - Smooth rotation (optional visual effect)

Implementation:
- Camera position stored as Vector2
- Update camera position before rendering
- All world objects rendered relative to camera
- Smooth interpolation: lerp(current, target, speed)
```

### UI AND HUD SYSTEM

#### HEADS-UP DISPLAY (HUD)
```
Layout (Always Visible):

Top-Left:
┌─────────────────────┐
│ SCORE: 000000       │
│ TIME: 0:00          │
│ RINGS: 0            │
└─────────────────────┘

Score Display:
- Format: 6 digits with leading zeros
- Updates in real-time
- Yellow text, black outline for visibility

Time Display:
- Format: M:SS (minutes:seconds)
- Counts up from 0:00
- Color codes:
  - White: 0:00 - 8:59 (safe)
  - Yellow: 9:00 - 9:50 (warning)
  - Red: 9:51+ (danger, flashing)
- At 10:00: Time Over (instant death)

Ring Display:
- Shows current ring count
- Color codes:
  - Yellow: 1-99 rings (safe)
  - Red: 0 rings (vulnerable, flashing)
- Flashing ring counter = at risk

Lives Display (Bottom-Left):
- Sonic icon × number
- Shows remaining lives
- Only visible during level play

Implementation:
- Fixed UI layer (not affected by camera)
- Bitmap font rendering for retro look
- Update every frame (60 FPS)
- Flash effect: toggle visibility every 10 frames
```

#### SCORE SYSTEM
```
Point Awards:

Enemy Destruction:
- Basic badnik: 100 points
- Flying badnik: 100 points
- Ranged badnik: 100 points
- Special badnik: 200 points
- Consecutive enemy kills:
  - 1st: 100 points
  - 2nd: 200 points
  - 3rd: 500 points
  - 4th+: 1000 points
  - Combo timer: 2 seconds

Ring Collection:
- Each ring: 10 points
- Collecting all rings in a section: 1000 bonus

Item Monitors:
- Breaking monitor: 10 points
- Collecting monitor contents: varies

Speed Bonuses:
- Speed sections: points based on speed
  - >8 pixels/frame: 100 points/second
  - >12 pixels/frame: 200 points/second

Special Actions:
- Perfect loop completion: 100 points
- Secret area discovered: 1000 points

Level Completion:
- Time bonus: (9:59 - completion_time) × 10
  - Under 0:30: 50,000 bonus
  - Under 1:00: 10,000 bonus
  - Under 2:00: 5,000 bonus
  - Under 3:00: 4,000 bonus
  - Under 4:00: 3,000 bonus
  - Under 5:00: 2,000 bonus
  - Otherwise: 1,000 bonus

- Ring bonus: rings × 100
- Perfect bonus (no hits): 10,000

Extra Life Awards:
- Every 50,000 points: 1-up
- At 100,000 points: 1-up
- Continue every 50,000 thereafter

Implementation:
- Track score in global variable
- Event system for point awards
- Display point popups (floating text)
- Combo system: timer resets on each kill
```

### AUDIO SYSTEM

#### MUSIC TRACKS
```
Required Music:

1. Title Screen Theme:
   - Upbeat, memorable melody
   - Loops seamlessly
   - Duration: ~1 minute

2. Green Hill Zone Theme:
   - Iconic, recognizable tune
   - Energetic and uplifting
   - Loops seamlessly
   - Must implement tempo system for speed shoes

3. Invincibility Theme:
   - Overrides level music
   - Fast-paced, exciting
   - Returns to level music after 20 seconds

4. Boss Theme:
   - Intense, dramatic
   - Loops seamlessly
   - (Implement in phase 2)

5. Act Clear Jingle:
   - Victory fanfare
   - Short: 10 seconds
   - Leads to score tally screen

6. Game Over Music:
   - Sad, dramatic
   - Short: 8 seconds
   - Fades to silence

Music System Features:
- Seamless looping (no gaps)
- Fade in/out transitions (1 second duration)
- Priority system:
  - Invincibility/Speed Shoes > Boss > Level > Silence
- Tempo modulation:
  - Speed shoes: increase tempo 10%
  - Underwater: decrease tempo 10%

Implementation:
- HTML5 Audio API or Web Audio API
- Preload all music on game start
- Current track: global variable
- Smooth transitions between tracks
```

#### SOUND EFFECTS
```
Essential Sound Effects:

Player Actions:
- Jump: spring-like "boing" sound
- Spin dash charging: revving motor sound (loops)
- Spin dash release: whoosh sound
- Skidding: tire screech
- Ring collect: bright chime (layered if multiple)
- Ring loss: scatter sound (glass breaking)
- Hurt/Hit: electric shock sound

Enemies:
- Enemy destroyed: explosion pop
- Badnik laser: zap sound
- Badnik fireball: projectile whoosh
- Buzz Bomber shoot: bee buzz + shoot

Objects:
- Spring bounce: boing (higher pitch for red springs)
- Monitor break: glass shatter
- Checkpoint: chime/bell sound
- Item collect: power-up jingle (2 seconds)
- Spike hit: sharp metallic impact

Environment:
- Speed booster: dash whoosh
- Loop entry: whoosh sound
- Water splash: splash (when entering water)
- Crumbling platform: rumble + collapse

UI:
- Menu select: blip sound
- Menu confirm: positive chime
- Pause: stop sound
- Unpause: continue sound

Sound Design Principles:
- Clear, distinct sounds (no confusion)
- Appropriate volume levels
- Layer multiple sounds when needed
- 8-bit/16-bit aesthetic for authenticity

Implementation:
- Sound pool system (preload all SFX)
- Multiple instances of same sound (ring collect)
- Volume control: SFX volume, music volume separate
- Positional audio (optional): sounds pan based on position
```

### ANIMATION SYSTEM

#### SONIC ANIMATION STATES
```
Idle Animation:
- Frames: 6 frames
- Duration: 3 seconds total (500ms per frame)
- Sequence:
  1. Standing, looking forward (neutral)
  2-3. Blinks eyes
  4-5. Looks at player (breaks 4th wall)
  6. Taps foot impatiently
- Loops after 6 seconds of no input

Walking Animation:
- Frames: 8 frames (walk cycle)
- Speed: Frame rate tied to velocity
  - Velocity 1-2: 10 FPS (slow walk)
  - Velocity 2-4: 15 FPS (normal walk)
  - Velocity 4-6: 20 FPS (fast walk -> jog)

Running Animation:
- Frames: 4 frames (simplified for speed)
- Speed: Frame rate tied to velocity
  - Velocity 6-8: 20 FPS (run)
  - Velocity 8-10: 25 FPS (fast run)
  - Velocity 10+: 30 FPS (super speed, legs blur)

Rolling Animation:
- Frames: 4 frames (spin ball)
- Speed: Frame rate tied to velocity
  - Velocity 4-6: 15 FPS
  - Velocity 6-8: 20 FPS
  - Velocity 8+: 30 FPS (ball blurs)

Jumping Animation:
- Frames: 4 frames (same as rolling)
- Speed: 20 FPS constant
- Visual: Spin ball while airborne

Skidding Animation:
- Frames: 4 frames
- Duration: 300ms total
- Plays when changing direction at high speed
- Dust cloud particle effect behind Sonic

Hurt Animation:
- Frames: 1 frame (surprised expression)
- Duration: Plays during knockback
- Flashing: 60 times per second (invincibility frames)

Death Animation:
- Frames: 8 frames
- Sequence:
  1-2: Surprised expression, small bounce
  3-4: Tumble backward
  5-6: Flip upside down
  7-8: Disappear downward
- Duration: 2 seconds
- Eyes follow player as he falls

Victory Animation (Goal Post):
- Frames: 6 frames
- Sequence:
  1: Running past signpost
  2-3: Signpost spins (shows Sonic face)
  4-5: Sonic skids to stop
  6: Victory pose (thumb up, smile)
- Plays once, holds final frame

Implementation:
- Sprite atlas: 512x512 containing all frames
- Frame metadata: {x, y, width, height, pivot}
- Animation controller: switch based on state
- Smooth transitions between animations
- Interpolate position for smooth movement
```

#### ENEMY ANIMATIONS
```
Motobug:
- Idle: 2 frames (shell wobbles slightly)
- Moving: 4 frames (treads rotate)
- Destroyed: 6 frame explosion

Buzz Bomber:
- Flying: 4 frames (wings flap)
- Shooting: 3 frames (opens bottom hatch)
- Destroyed: 6 frame explosion

Crabmeat:
- Walking: 6 frames (legs move)
- Shooting: 4 frames (claws raise and fire)
- Destroyed: 6 frame explosion

General Enemy Patterns:
- Animate at 10-15 FPS
- Smooth, mechanical movement
- Explosion releases animal sprite
- Animal jumps upward then disappears

Implementation:
- Each enemy: separate animation controller
- State-driven animation (patrol/attack/destroyed)
- Particle system for explosions
```

### INPUT SYSTEM

#### CONTROL SCHEME
```
Keyboard Controls (Primary):

Movement:
- Arrow Keys / WASD:
  - LEFT/A: Move left
  - RIGHT/D: Move right
  - DOWN/S: Crouch/Look down (when standing)
  - DOWN/S: Roll (when moving)
  - UP/W: Look up (when standing)

Actions:
- SPACE / Z / X: Jump
- SPACE (while rolling): Jump from roll
- DOWN + SPACE (while standing): Spin dash (optional, later version)

System:
- ENTER / P: Pause game
- ESC: Return to title screen (confirm dialog)
- R: Restart level (debug mode)

Touch Controls (Mobile):

On-Screen D-Pad:
- Virtual joystick on left side
- Translucent, 100 pixel diameter
- 8-directional input

Jump Button:
- Large button on right side
- Red/yellow color, 80 pixel diameter
- Visual press feedback

Input Handling Features:

1. Input Buffering:
   - Store inputs for 5 frames (100ms)
   - Execute when conditions met
   - Example: Jump buffering
     - Player presses jump while airborne
     - Jump executes on landing automatically
   - Improves responsiveness feel

2. Coyote Time:
   - 6 frames of grace period after walking off platform
   - Can still jump during this time
   - Makes platforming more forgiving

3. Diagonal Input Priority:
   - If UP+LEFT pressed: prioritize LEFT (horizontal movement)
   - DOWN+LEFT/RIGHT: enter roll if moving

4. Multiple Jump Keys:
   - Any mapped jump key works
   - Allows player preference

Implementation:
- Event listeners for keydown/keyup
- Input state object (tracks all keys)
- Update input state every frame
- Buffer queue: array of recent inputs
- Coyote timer: decrements when airborne after ground
```

### GAME STATE MANAGEMENT

#### GAME STATES
```
State Machine:

1. TITLE_SCREEN:
   - Display: Sonic logo, press start message
   - Input: Any key starts game
   - Music: Title theme
   - Animated: Sonic and friends on screen
   - Options: visible after 10 seconds
     - Start Game
     - Options (sound settings)
     - Credits

2. LOADING:
   - Display: Loading bar, tips
   - Actions:
     - Load level assets
     - Initialize game objects
     - Prepare audio
   - Duration: 1-3 seconds
   - Transition to PLAYING

3. PLAYING:
   - Main gameplay state
   - All systems active
   - Can transition to:
     - PAUSED (player input)
     - LEVEL_COMPLETE (reach goal)
     - GAME_OVER (death with 0 lives)

4. PAUSED:
   - Display: semi-transparent overlay
   - Show: "PAUSED" text
   - Music: muted/paused
   - Input: unpause or quit
   - Background: frozen game frame

5. LEVEL_COMPLETE:
   - Display: Sonic victory animation
   - Show: score tally screen
     - Time bonus calculation
     - Ring bonus calculation
     - Perfect bonus (if applicable)
     - Total score
   - Duration: 10 seconds
   - Transition: Next level or end screen

6. GAME_OVER:
   - Display: "GAME OVER" text
   - Music: Game over theme
   - Options:
     - Continue (if continues available)
     - Return to title
   - Duration: 5 seconds before auto-return

7. OPTIONS_MENU:
   - Display: Settings interface
   - Options:
     - Music Volume: 0-100%
     - SFX Volume: 0-100%
     - Controls: Remap keys
     - Reset to defaults
   - Save settings to localStorage

Implementation:
- Global state variable
- State transition function
- Each state: init, update, render functions
- Clean up on state exit
```

### CODE ARCHITECTURE REQUIREMENTS

#### MODULAR STRUCTURE
```
// ============================================================
// GAME ENGINE CORE
// ============================================================

class GameEngine {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.currentState = GameState.TITLE_SCREEN;
    this.deltaTime = 0;
    this.lastFrameTime = 0;
    this.targetFPS = 60;
  }

  init() {
    // Initialize canvas
    // Setup event listeners
    // Load assets
    // Start game loop
  }

  gameLoop(currentTime) {
    // Calculate delta time
    // Update current state
    // Render current state
    // Request next frame
  }

  setState(newState) {
    // Clean up current state
    // Initialize new state
    // Update currentState
  }
}

// ============================================================
// PHYSICS ENGINE
// ============================================================

class PhysicsEngine {
  // Constants
  GRAVITY = 0.21875;
  GROUND_ACCELERATION = 0.046875;
  GROUND_FRICTION = 0.046875;
  AIR_ACCELERATION = 0.09375;
  
  constructor() {
    this.entities = [];
  }

  update(deltaTime) {
    // Update all physics objects
    // Handle collisions
    // Apply forces
  }

  checkCollision(entity1, entity2) {
    // AABB collision detection
    // Return collision data
  }

  resolveCollision(entity1, entity2, collisionData) {
    // Separate entities
    // Apply collision response
  }

  checkTerrainCollision(entity, level) {
    // Raycast sensors
    // Check tile collision
    // Calculate ground angle
    // Return collision result
  }
}

// ============================================================
// PLAYER (SONIC) CLASS
// ============================================================

class Player {
  constructor(x, y) {
    this.position = {x, y};
    this.velocity = {x: 0, y: 0};
    this.state = PlayerState.IDLE;
    this.grounded = false;
    this.groundAngle = 0;
    this.invulnerable = false;
    this.powerUp = PowerUpType.NONE;
    
    // Hitbox
    this.width = 20;
    this.height = 40;
    
    // Animation
    this.currentAnimation = null;
    this.animationFrame = 0;
    this.animationTimer = 0;
    
    // Stats
    this.rings = 0;
    this.lives = 3;
    this.score = 0;
  }

  update(deltaTime, input, level) {
    // Handle input
    // Update physics
    // Update animation
    // Check collisions
  }

  handleInput(input) {
    // Process player controls
  }

  updatePhysics(deltaTime, level) {
    // Apply movement physics
    // Handle ground/air state
    // Update velocity and position
  }

  updateAnimation(deltaTime) {
    // Progress animation frames
    // Switch animations based on state
  }

  takeDamage() {
    // Lose rings
    // Play hurt animation
    // Set invulnerability frames
  }

  collectRing() {
    this.rings++;
    this.score += 10;
    // Play sound
  }

  render(ctx, camera) {
    // Draw sprite
    // Draw effects (shield, invincibility)
  }
}

// ============================================================
// LEVEL CLASS
// ============================================================

class Level {
  constructor(levelData) {
    this.width = levelData.width;
    this.height = levelData.height;
    this.tiles = levelData.tiles;
    this.enemies = [];
    this.collectibles = [];
    this.hazards = [];
    this.backgroundLayers = [];
    
    this.initializeLevel(levelData);
  }

  initializeLevel(levelData) {
    // Parse level data
    // Create enemies
    // Place collectibles
    // Setup parallax layers
  }

  update(deltaTime, player) {
    // Update enemies
    // Update collectibles
    // Check player interactions
  }

  render(ctx, camera) {
    // Render background layers (parallax)
    // Render terrain tiles
    // Render foreground elements
  }

  getTileAt(x, y) {
    // Return tile type at world position
  }

  checkTileCollision(entity) {
    // Check collision with terrain
    // Return collision data
  }
}

// ============================================================
// ENEMY BASE CLASS
// ============================================================

class Enemy {
  constructor(x, y, type) {
    this.position = {x, y};
    this.velocity = {x: 0, y: 0};
    this.type = type;
    this.state = EnemyState.PATROL;
    this.active = true;
    this.patrolRange = 200;
    this.patrolStart = x;
  }

  update(deltaTime, player, level) {
    // Update AI behavior
    // Update physics
    // Check player collision
  }

  updateAI(player) {
    // Enemy-specific AI logic
    // Override in subclasses
  }

  takeDamage() {
    // Play explosion animation
    // Release animal
    // Award points to player
    // Deactivate enemy
  }

  render(ctx, camera) {
    // Draw enemy sprite
  }
}

// ============================================================
// ASSET MANAGER
// ============================================================

class AssetManager {
  constructor() {
    this.images = {};
    this.sounds = {};
    this.music = {};
    this.loadProgress = 0;
  }

  async loadAllAssets() {
    // Load sprites
    // Load sounds
    // Load music
    // Track progress
  }

  getSprite(name) {
    return this.images[name];
  }

  playSound(name) {
    // Play sound effect
    // Handle volume
  }

  playMusic(name, loop = true) {
    // Play music track
    // Fade in if needed
  }
}

// ============================================================
// CAMERA SYSTEM
// ============================================================

class Camera {
  constructor(width, height) {
    this.position = {x: 0, y: 0};
    this.target = null;
    this.width = width;
    this.height = height;
    this.deadZone = {x: 60, y: 80};
    this.bounds = {
      left: 0,
      right: 0,
      top: 0,
      bottom: 0
    };
  }

  follow(target) {
    this.target = target;
  }

  update(deltaTime) {
    if (!this.target) return;
    
    // Calculate target position
    // Apply dead zone logic
    // Lerp to target
    // Clamp to bounds
  }

  setBounds(left, right, top, bottom) {
    this.bounds = {left, right, top, bottom};
  }

  worldToScreen(worldX, worldY) {
    return {
      x: worldX - this.position.x,
      y: worldY - this.position.y
    };
  }
}
```

### IMPLEMENTATION PHASES

#### PHASE 1: FOUNDATION (Build This First)
```
Week 1 Goals:

1. Setup Project Structure:
   - Create HTML file with canvas
   - Setup JavaScript modules
   - Implement game loop (60 FPS)
   - Basic rendering system

2. Player Character Basics:
   - Sonic sprite loading
   - Basic movement (left/right)
   - Simple jumping
   - Ground collision (flat surfaces only)
   - Animation system (idle, walk, jump)

3. Level Framework:
   - Simple tile-based level
   - Flat ground with platforms
   - Camera following Sonic
   - Background rendering

4. Input System:
   - Keyboard controls
   - Input buffering
   - Responsive controls

Deliverable: Sonic can run, jump, and move through a basic level.
```

#### PHASE 2: PHYSICS REFINEMENT
```
Week 2 Goals:

1. Advanced Physics:
   - Slope collision detection
   - Momentum transfer on slopes
   - Rolling mechanics
   - Air control refinement
   - Gravity fine-tuning

2. Terrain Types:
   - 45° slopes
   - 22.5° gentle slopes
   - Platforms (jump-through)
   - Solid walls and ceilings

3. Visual Polish:
   - Parallax scrolling (3 layers)
   - Animation speed tied to velocity
   - Skidding animation
   - Dust particle effects

Deliverable: Physics feel authentic to original game.
```

#### PHASE 3: GAME SYSTEMS
```
Week 3 Goals:

1. Ring System:
   - Ring collection
   - Ring loss on damage
   - Ring scattering physics
   - Ring counter HUD

2. Enemy AI:
   - Motobug implementation
   - Basic enemy collision
   - Enemy destruction
   - Point system

3. Hazards:
   - Spikes
   - Death pits
   - Respawn system

4. HUD Implementation:
   - Score display
   - Time counter
   - Ring counter
   - Lives display

Deliverable: Complete game loop with challenge.
```

#### PHASE 4: LEVEL CONTENT
```
Week 4 Goals:

1. Green Hill Zone Act 1:
   - Complete level layout (4500 pixels)
   - Multiple route implementation
   - Enemy placement
   - Ring placement
   - Collectible placement

2. More Enemies:
   - Buzz Bomber
   - Crabmeat
   - Newtron

3. Item Monitors:
   - All 5 monitor types
   - Power-up system
   - Shield implementation
   - Invincibility

4. Checkpoint System:
   - Lamppost placement
   - Save/load game state
   - Respawn at checkpoint

Deliverable: Full playable Green Hill Zone Act 1.
```

#### PHASE 5: SPECIAL FEATURES
```
Week 5 Goals:

1. Special Mechanics:
   - Loop-de-loop system
   - Spring mechanics
   - Speed booster tiles
   - Crumbling platforms
   - Moving platforms

2. Advanced AI:
   - Projectile enemies
   - Complex patrol patterns
   - Environmental hazards

3. Polish:
   - All sound effects
   - Music implementation
   - Transition effects
   - Victory sequence
   - Game over sequence

Deliverable: Feature-complete Green Hill Zone.
```

#### PHASE 6: EXPANDABILITY
```
Week 6 Goals:

1. Level Editor Support:
   - JSON level format
   - Easy level loading
   - Modular level structure
   - Documentation for adding levels

2. Additional Features:
   - Title screen
   - Options menu
   - Level select (if multiple levels)
   - Save system (localStorage)

3. Code Cleanup:
   - Comment all code
   - Optimize performance
   - Bug fixes
   - Testing

4. Extension Points:
   - Clear areas for adding:
     - New enemies (template class)
     - New power-ups
     - New level sections
     - New mechanics

Deliverable: Production-ready, extensible codebase.
```

### CRITICAL SUCCESS FACTORS

#### 1. FEEL IS EVERYTHING
```
The game must FEEL like Sonic:
- Momentum-based physics (not instant velocity changes)
- Speed feels exhilarating but controllable
- Jumping feels weighty and responsive
- Rolling feels smooth and powerful
- Collision never feels "sticky" or unfair

Test extensively:
- Can you run fast and feel in control?
- Does building speed downhill feel rewarding?
- Can you navigate tight platforms precisely?
- Does combat feel fair and responsive?

If the physics don't feel right, nothing else matters.
```

#### 2. VISUAL FEEDBACK
```
Every action needs clear feedback:
- Collecting rings: visible, audible confirmation
- Taking damage: unmistakable visual + sound
- Speed changes: animation speed reflects it
- Jumping: clear arc trajectory
- Rolling: distinct visual state

Polish details:
- Screen shake on big impacts
- Particle effects for emphasis
- Color flashing for invulnerability
- Smooth camera movement
```

#### 3. PERFORMANCE
```
Target: Solid 60 FPS at all times

Optimization strategies:
- Object pooling (rings, enemies, particles)
- Spatial hashing for collision detection
- Cull off-screen objects (don't update)
- Optimize render calls (batch drawing)
- Limit particle count (max 100 active)

Profile regularly:
- Use browser dev tools
- Monitor frame time
- Check memory usage
- Test on lower-end devices
```

#### 4. EXTENSIBILITY
```
Code must be easy to extend:

Good practices:
- Clear class hierarchy
- Documented public APIs
- Modular systems (don't over-couple)
- Configuration files for game constants
- Template classes for new content

Example extensions:
- Adding new enemy: extend Enemy class
- Adding new power-up: add to PowerUpType enum
- Adding new level: create JSON level file
- Adding new mechanic: create new component

Document extension points clearly in code.
```

### ASSET CREATION GUIDANCE

Since we're recreating Sonic, you cannot use original copyrighted sprites directly. You must create new art inspired by the original style:

#### SPRITE CREATION
```
Style Guide:
- 16-bit aesthetic (limited colors)
- Clean pixel art (no anti-aliasing)
- High contrast for visibility
- Expressive character animation
- Consistent scale (Sonic = 40 pixels tall standing)

Sonic Sprite Requirements:
- Idle: 6 frames
- Walk: 8 frames
- Run: 4 frames
- Roll: 4 frames
- Jump: 4 frames (same as roll)
- Skid: 4 frames
- Hurt: 1 frame
- Death: 8 frames
- Victory: 6 frames

Enemy Sprites:
- Each enemy: 4-8 frames
- Destruction: 6 frame explosion
- Animal release: 2 frame animal sprite

Terrain Tiles:
- 32x32 pixels per tile
- Grass, dirt, checkered patterns
- Slope variations (8 types minimum)
- Platform variations

Collectibles:
- Ring: 8 frames (rotation)
- Monitors: 1 frame per type (5 types)
- Spring: 4 frames (compressed animation)

Tools for Creation:
- Aseprite (recommended for pixel art)
- Piskel (free online tool)
- GraphicsGale
- Even GIMP with grid settings

Export:
- PNG format, transparent background
- Sprite sheet atlas (organized grid)
- Include metadata (frame positions, sizes)
```

#### AUDIO CREATION
```
Music:
- Recreate in similar style (chiptune/16-bit)
- Use tools: FamiTracker, BeepBox, or FL Studio
- Format: MP3 or OGG for web
- Loop points: seamless (fade in/out)

Sound Effects:
- Can use royalty-free SFX libraries
- Edit in Audacity to fit aesthetic
- Format: Short WAV or MP3
- Normalize volume levels

Resources:
- freesound.org (royalty-free sounds)
- OpenGameArt.org (game assets)
- Create synthetic sounds with sfxr/jsfxr

Quality:
- 16-bit or 8-bit audio aesthetic
- Consistent volume levels across all SFX
- Clear, distinct sounds (no muddiness)
```

### TESTING AND QUALITY ASSURANCE

#### PLAYTESTING CHECKLIST
```
Movement Feel:
□ Running feels smooth and responsive
□ Jumping arc feels natural
□ Slope physics work correctly
□ Rolling feels powerful
□ Air control is appropriate
□ No "sticking" to walls or floors

Level Design:
□ Multiple routes are clear
□ Upper route rewards skill
□ Lower route is accessible but slower
□ Rings guide the player
□ Enemy placement is fair
□ Hazards are visible and avoidable
□ Checkpoints are well-placed

Game Feel:
□ Speed feels exhilarating
□ Combat is satisfying
□ Collecting rings feels rewarding
□ Taking damage feels fair (not cheap)
□ Victory feels earned
□ Difficulty curve is appropriate

Technical:
□ Consistent 60 FPS
□ No visual glitches
□ Audio plays correctly
□ No softlocks or game-breaking bugs
□ Respawn system works
□ Collision detection is accurate

Polish:
□ Animations are smooth
□ Camera follows appropriately
□ UI is clear and readable
□ Sound effects are satisfying
□ Music loops seamlessly
□ Visual effects enhance gameplay
```

### FINAL DELIVERABLE REQUIREMENTS

Your completed game must include:

1. **Playable Green Hill Zone Act 1**:
   - Complete 4500 pixel level
   - Multiple routes implemented
   - All enemies functional
   - All collectibles working
   - Goal signpost ending

2. **Core Sonic Physics**:
   - Momentum-based movement
   - Slope physics
   - Rolling mechanics
   - Jumping and air control
   - Authentic feel matching original

3. **Game Systems**:
   - Ring collection and loss
   - Enemy AI (3+ enemy types)
   - Hazards (spikes, pits)
   - Item monitors (all 5 types)
   - Checkpoint system
   - Score and time tracking
   - Lives system

4. **Audio/Visual**:
   - Background music (looping)
   - Sound effects (all major actions)
   - Sprite animations (smooth)
   - Parallax scrolling background
   - HUD display
   - Visual effects (particles, screen shake)

5. **User Interface**:
   - Title screen
   - Pause menu
   - Game over screen
   - Victory sequence with score tally
   - Controls display

6. **Code Quality**:
   - Well-organized, modular structure
   - Commented code (explain complex sections)
   - Performance optimized (60 FPS)
   - Easy to extend (template for new content)
   - Bug-free core gameplay

7. **Documentation** (Include in code):
   - How to add new levels
   - How to add new enemies
   - How to add new power-ups
   - Configuration constants explained
   - Extension points clearly marked

### DEPLOYMENT INSTRUCTIONS

```
For HTML5/JavaScript version:

1. Single HTML file with embedded CSS/JavaScript, OR
2. Separate files:
   - index.html (main page)
   - game.js (game logic)
   - style.css (styling)
   - /assets folder (sprites, sounds, music)

3. How to run:
   - Open index.html in modern browser
   - Should work in Chrome, Firefox, Safari, Edge
   - No server required (unless loading external assets)

4. Controls:
   - Arrow Keys: Move
   - Space: Jump
   - Enter: Pause
   - Clearly displayed on title screen

5. Performance:
   - Target: 60 FPS on mid-range devices
   - Test on: Desktop, laptop, tablet
   - Optimize for: Chrome (most common)
```

### RESPONSE FORMAT

Your response should include:

1. **Technology Choice Justification**:
   - Why you chose your implementation language/framework
   - Trade-offs considered
   - Expected benefits

2. **Implementation Plan**:
   - Which phase you're starting with
   - Timeline for completion
   - Any concerns or challenges

3. **Complete Working Code**:
   - All necessary files
   - Clear structure
   - Commented appropriately
   - Ready to run

4. **Extension Guide**:
   - How to add more levels
   - How to add new features
   - Configuration options
   - Next steps for improvement

### CRITICAL REMINDERS

- **Research First**: Study the original game mechanics before coding
- **Feel Over Accuracy**: Capturing the feel is more important than pixel-perfect recreation
- **Playability First**: Game must be fun and playable above all else
- **Extensible Code**: Structure for easy additions later
- **Performance**: Maintain 60 FPS consistently
- **Polish**: Small details make huge difference in game feel
- **Test Thoroughly**: Play your own game extensively

### MINIMUM VIABLE PRODUCT (MVP)

If you need to prioritize due to time/complexity, the absolute minimum must include:

1. Sonic with basic physics (run, jump, roll)
2. Simple Green Hill Zone section (1000 pixels minimum)
3. Ring collection
4. 1 enemy type (Motobug)
5. Spikes (hazard)
6. Basic HUD (rings, score, time)
7. Death and respawn
8. Goal signpost

Everything else is enhancement. But aim for complete Phase 1-4 for a truly satisfying game.

### FINAL NOTE TO AI

This is an ambitious project. The original Sonic the Hedgehog was created by a team of talented developers over many months. You're recreating it alone. 

Focus on:
1. Getting the physics feeling right (most important)
2. Creating a fun, playable level
3. Making the code extensible for future additions
4. Delivering something that actually works and is enjoyable

Don't worry about:
1. Perfect pixel-art (functional > beautiful)
2. Every minor detail from original
3. Additional levels (one great level is enough)
4. Advanced features (focus on core gameplay)

The goal is a solid foundation that can be built upon. Make something playable, fun, and expandable. If it feels like Sonic and plays well, you've succeeded.

Now go create an amazing Sonic recreation! 🦔💨
