$ErrorActionPreference = "Stop"
function RGB([int]$r,[int]$g,[int]$b){ $r + ($g -shl 8) + ($b -shl 16) }

$BG   = RGB 8 8 10
$CARD = RGB 18 18 22
$INK  = RGB 28 28 34
$AMB  = RGB 255 176 32
$CYAN = RGB 80 230 220
$RED  = RGB 255 84 84
$GRN  = RGB 56 220 130
$WHT  = RGB 255 255 255
$SOFT = RGB 220 220 226
$DIM  = RGB 140 140 150
$W=960; $H=540
$nl = [char]13 + [char]10
$TOTAL = 8

function BoxR($s,$x,$y,$w,$h,$c){
  $o=$s.Shapes.AddShape(1,$x,$y,$w,$h); $o.Fill.Solid(); $o.Fill.ForeColor.RGB=$c; $o.Line.Visible=0; $o
}
function BoxC($s,$x,$y,$w,$h,$c){
  $o=$s.Shapes.AddShape(5,$x,$y,$w,$h); $o.Fill.Solid(); $o.Fill.ForeColor.RGB=$c; $o.Line.Visible=0; $o.Adjustments.Item(1)=0.08; $o
}
function BoxO($s,$x,$y,$d,$c){
  $o=$s.Shapes.AddShape(9,$x,$y,$d,$d); $o.Fill.Solid(); $o.Fill.ForeColor.RGB=$c; $o.Line.Visible=0; $o
}
function BoxT($s,$x,$y,$w,$h,$txt,$sz,$c,$b,$a){
  $o=$s.Shapes.AddTextbox(1,$x,$y,$w,$h)
  $o.Line.Visible=0; $o.Fill.Visible=0
  $tr=$o.TextFrame.TextRange
  $tr.Text=$txt
  $tr.Font.Name="Calibri"
  $tr.Font.Size=$sz
  $tr.Font.Color.RGB=$c
  $tr.Font.Bold=$(if($b){-1}else{0})
  $tr.ParagraphFormat.Alignment=$a
  $o.TextFrame.WordWrap=-1
  $o.TextFrame.MarginLeft=3; $o.TextFrame.MarginRight=3
  $o.TextFrame.MarginTop=1; $o.TextFrame.MarginBottom=1
  $o
}
function NewS($p){
  $s=$p.Slides.Add($p.Slides.Count+1,12)
  $s.FollowMasterBackground=0
  $s.Background.Fill.Solid()
  $s.Background.Fill.ForeColor.RGB=$BG
  $s
}
function Foot($s,$n){
  [void](BoxR $s 0 534 960 6 $AMB)
  [void](BoxT $s 24 508 420 20 "CAMPUSPULSE AI  |  HACKATHON PRESENTATION" 10 $DIM $true 1)
  [void](BoxT $s 840 508 90 20 ("0$n / 0$TOTAL") 10 $DIM $false 3)
}
function Note($slide,$text){
  try {
    $slide.NotesPage.Shapes.Placeholders.Item(2).TextFrame.TextRange.Text = $text
  } catch {}
}

$ppt=$null; $pres=$null
try {
  $ppt=New-Object -ComObject PowerPoint.Application
  $ppt.Visible=-1
  $pres=$ppt.Presentations.Add()
  $pres.PageSetup.SlideWidth=$W
  $pres.PageSetup.SlideHeight=$H

  # ============================================================
  # 01 TITLE
  # ============================================================
  $s=NewS $pres
  [void](BoxR $s 0 0 960 8 $AMB)
  [void](BoxT $s 36 28 700 18 "HACKATHON PRESENTATION  |  4 MINUTES  |  RS 0 STACK" 12 $CYAN $true 1)
  [void](BoxT $s 30 64 700 58 "CampusPulse AI" 40 $WHT $true 1)
  [void](BoxT $s 36 128 640 36 "Smart campus issue desk" 22 $AMB $false 1)
  [void](BoxT $s 36 176 620 70 ("Scattered WhatsApp complaints become a ranked," + $nl + "map-visible maintenance pipeline.") 18 $SOFT $false 1)

  [void](BoxC $s 36 270 200 86 $INK)
  [void](BoxT $s 48 280 176 28 "0" 22 $AMB $true 1)
  [void](BoxT $s 48 312 176 32 "student login" 12 $DIM $false 1)
  [void](BoxC $s 248 270 200 86 $INK)
  [void](BoxT $s 260 280 176 28 "2" 22 $CYAN $true 1)
  [void](BoxT $s 260 312 176 32 "roles, one app" 12 $DIM $false 1)
  [void](BoxC $s 460 270 200 86 $INK)
  [void](BoxT $s 472 280 176 28 "Rs 0" 20 $WHT $true 1)
  [void](BoxT $s 472 312 176 32 "to run the demo" 12 $DIM $false 1)

  [void](BoxC $s 36 372 624 116 $CARD)
  [void](BoxT $s 52 384 592 20 "TEAM  (edit these names before you present)" 12 $AMB $true 1)
  [void](BoxT $s 52 412 592 28 "Team CampusPulse" 18 $WHT $true 1)
  [void](BoxT $s 52 446 592 28 "Member 1    Member 2    Member 3    Member 4" 14 $SOFT $false 1)

  [void](BoxR $s 688 0 272 540 $AMB)
  [void](BoxT $s 704 70 240 18 "TODAY YOU WILL SEE" 12 $BG $true 1)
  [void](BoxT $s 704 110 240 280 ("1. The campus mess" + $nl + $nl + "2. The product we built" + $nl + $nl + "3. The exact AI + stack" + $nl + $nl + "4. A 90-second live demo" + $nl + $nl + "5. Health score 72 to 75") 15 $BG $false 1)
  [void](BoxT $s 704 430 240 50 "Then we take questions." 14 $BG $true 1)
  [void](BoxT $s 24 508 400 20 "CAMPUSPULSE AI  |  HACKATHON PRESENTATION" 10 $DIM $true 1)
  Note $s "Hi, we are Team CampusPulse. CampusPulse AI turns hostel WhatsApp complaints into a live map and a safety-first admin queue. No student login. Entirely free stack. In 4 minutes we will show the problem, what we built, the tech, and a live demo."

  # ============================================================
  # 02 PROBLEM
  # ============================================================
  $s=NewS $pres
  [void](BoxR $s 0 0 8 540 $RED)
  [void](BoxT $s 28 16 900 16 "01  PROBLEM" 12 $RED $true 1)
  [void](BoxT $s 24 40 900 40 "Campus issues are real. Reporting is broken." 24 $WHT $true 1)
  [void](BoxT $s 28 86 900 36 "Leaking tap. Flickering light. Dead library Wi-Fi. Broken chair. Dark path at night." 14 $SOFT $false 1)

  $x=@(28,328,628)
  $tag=@("CRITICAL","HIGH","LOST")
  $tc=@($RED,$AMB,$DIM)
  $hd=@("Dark path, Hostel C","Library Wi-Fi dead","Broken chair, LH-2")
  $bd=@(
    "Unsafe at night. Nobody filed. Hassle + fear of complaining.",
    "11 students stuck. 0 tickets. Someone else already did.",
    "Told a staff member verbally. Forgotten by evening."
  )
  for($i=0;$i -lt 3;$i++){
    [void](BoxC $s $x[$i] 134 292 130 $CARD)
    [void](BoxR $s $x[$i] 134 8 130 $tc[$i])
    [void](BoxT $s ($x[$i]+20) 142 256 16 $tag[$i] 11 $tc[$i] $true 1)
    [void](BoxT $s ($x[$i]+20) 164 256 28 $hd[$i] 15 $WHT $true 1)
    [void](BoxT $s ($x[$i]+20) 198 256 54 $bd[$i] 12 $SOFT $false 1)
  }

  [void](BoxT $s 28 280 900 20 "Five gaps this creates" 13 $AMB $true 1)
  $k=@("NO TRACK","NO RANK","DUPES","NO TRAIL","FEAR")
  $v=@(
    "Student cannot see if anyone started the job.",
    "A lock is fixed. An electrical hazard waits.",
    "Same leak in 8 chats. Or zero reports.",
    "No record of what dies every month.",
    "Name on a complaint. They stay quiet."
  )
  for($i=0;$i -lt 5;$i++){
    $xx=28+($i*186)
    [void](BoxC $s $xx 308 176 176 $CARD)
    [void](BoxT $s ($xx+10) 318 156 32 $k[$i] 13 $AMB $true 1)
    [void](BoxT $s ($xx+10) 356 156 110 $v[$i] 12 $SOFT $false 1)
  }
  Foot $s 2
  Note $s "Do not rush. Point at the three tickets. Then say: the core failure is communication. WhatsApp, verbal, office notes. Admin cannot see urgency, duplicates, or repair time. That is what we fix."

  # ============================================================
  # 03 SOLUTION
  # ============================================================
  $s=NewS $pres
  [void](BoxR $s 0 0 8 540 $CYAN)
  [void](BoxT $s 28 16 900 16 "02  SOLUTION" 12 $CYAN $true 1)
  [void](BoxT $s 24 40 900 40 "One web app. Two roles. One pipeline." 24 $WHT $true 1)
  [void](BoxT $s 28 86 900 40 "Anonymous, location-tagged reports become a prioritized, trackable maintenance queue." 15 $SOFT $false 1)

  [void](BoxC $s 28 140 444 250 $CARD)
  [void](BoxT $s 44 152 412 22 "STUDENT  |  NO ACCOUNT" 14 $AMB $true 1)
  [void](BoxT $s 44 186 412 180 ("Pin the spot on the campus map" + $nl + "Type, speak, or add a photo" + $nl + "No name, email, phone, or student ID" + $nl + "Me too on a pin that already exists" + $nl + "Ticket ID + public status on the map") 15 $SOFT $false 1)

  [void](BoxC $s 488 140 444 250 $CARD)
  [void](BoxT $s 504 152 412 22 "ADMIN  |  ONE LOGIN" 14 $CYAN $true 1)
  [void](BoxT $s 504 186 412 180 ("Safety-first priority queue" + $nl + "Assign, On it + ETA, resolve" + $nl + "Optional after-photo as proof" + $nl + "Campus + building health scores" + $nl + "Avg assign time and avg resolve time") 15 $SOFT $false 1)

  [void](BoxC $s 28 406 904 86 $INK)
  [void](BoxT $s 44 418 872 22 "WHAT WE ARE SOLVING" 12 $AMB $true 1)
  [void](BoxT $s 44 444 872 36 "Frictionless reporting for students. Real-time visibility for facilities. Same map for both." 15 $SOFT $false 1)
  Foot $s 3
  Note $s "Hold this slide. Student side is identity-light on purpose. Admin is the only login. Shared map is the product. Then go to how it works."

  # ============================================================
  # 04 HOW IT WORKS
  # ============================================================
  $s=NewS $pres
  [void](BoxR $s 0 0 8 540 $AMB)
  [void](BoxT $s 28 16 900 16 "03  HOW IT WORKS" 12 $AMB $true 1)
  [void](BoxT $s 24 40 900 36 "Report. Understand. Rank. Fix. Measure." 24 $WHT $true 1)

  $st=@("1  REPORT","2  AI","3  MERGE","4  QUEUE","5  FIX")
  $sd=@(
    "Pin, voice or text. Or tap Me too. Nearby prompt if it already exists.",
    "Groq returns category, severity, department, safety 1-5.",
    "MiniLM + 40m radius. Same leak becomes one cluster. Impact rises.",
    "Priority = 40% safety + 25% people + 20% wait + 15% place.",
    "On it, ETA, proof photo. Times stored. Health score updates."
  )
  for($i=0;$i -lt 5;$i++){
    $yy=88+($i*72)
    [void](BoxC $s 24 $yy 600 64 $CARD)
    [void](BoxT $s 40 ($yy+6) 140 48 $st[$i] 14 $AMB $true 1)
    [void](BoxT $s 180 ($yy+14) 428 40 $sd[$i] 13 $SOFT $false 1)
  }

  [void](BoxC $s 644 88 292 360 $CARD)
  [void](BoxT $s 660 104 260 18 "IF JUDGES ASK ABOUT AI" 11 $CYAN $true 1)
  [void](BoxT $s 660 136 260 280 ("One text model. Not six." + $nl + $nl + "Classify: Groq Llama" + $nl + $nl + "Duplicates: MiniLM" + $nl + $nl + "Priority: a public formula" + $nl + $nl + "Hotspot: 3 hits / 14 days" + $nl + $nl + "If Groq dies: keywords still file the ticket.") 14 $SOFT $false 1)
  Foot $s 4
  Note $s "Walk the five rows top to bottom. Then point at the right card: we did not fake YOLO or a trained forest. Honest AI is classify + merge + formula. That is a feature, not a weakness."

  # ============================================================
  # 05 WHAT WE IMPLEMENTED
  # ============================================================
  $s=NewS $pres
  [void](BoxR $s 0 0 8 540 $CYAN)
  [void](BoxT $s 28 16 900 16 "04  WHAT WE IMPLEMENTED" 12 $CYAN $true 1)
  [void](BoxT $s 24 40 900 36 "Shipped this weekend. This is the MVP." 24 $WHT $true 1)

  $L=@(
    "Anonymous pin + text + photo",
    "Browser voice, no Whisper server",
    "Me too on an open pin",
    "Already exists? prompt",
    "Ticket + public map status",
    "Per-building health score"
  )
  $R=@(
    "Groq classify + keyword fallback",
    "MiniLM duplicate merge",
    "Admin queue, On it, ETA",
    "Resolve proof photo",
    "Avg assign / resolve time",
    "Hotspot rule, 3 in 14 days"
  )
  [void](BoxC $s 24 88 452 300 $CARD)
  [void](BoxT $s 40 100 420 20 "STUDENT" 13 $AMB $true 1)
  [void](BoxC $s 492 88 444 300 $CARD)
  [void](BoxT $s 508 100 412 20 "ADMIN + AI" 13 $CYAN $true 1)
  for($i=0;$i -lt 6;$i++){
    $yy=132+($i*40)
    [void](BoxO $s 44 $yy 9 $AMB)
    [void](BoxT $s 62 ($yy-8) 396 28 $L[$i] 14 $SOFT $false 1)
    [void](BoxO $s 512 $yy 9 $CYAN)
    [void](BoxT $s 530 ($yy-8) 388 28 $R[$i] 14 $SOFT $false 1)
  }

  [void](BoxC $s 24 402 912 92 $INK)
  [void](BoxT $s 40 412 880 18 "PRIORITY  (locked)" 12 $AMB $true 1)
  [void](BoxT $s 40 440 880 40 "40% SAFETY   +   25% AFFECTED PEOPLE   +   20% WAIT   +   15% LOCATION" 16 $WHT $true 1)
  Foot $s 5
  Note $s "This is the honesty slide. Read the formula out loud. Electrical hazard beats a broken lock. Then say what we refused to fake: no YOLO, no Whisper GPU, no pretend Random Forest."

  # ============================================================
  # 06 ARCHITECTURE
  # ============================================================
  $s=NewS $pres
  [void](BoxR $s 0 0 8 540 $GRN)
  [void](BoxT $s 28 16 900 16 "05  ARCHITECTURE  |  ALL FREE TIERS" 12 $GRN $true 1)
  [void](BoxT $s 24 40 900 36 "One Next.js app. No second backend. No GPU." 24 $WHT $true 1)

  $bx=@("Student / Admin browser","Vercel  |  Next.js API","Groq Llama","MiniLM embed","Supabase","Leaflet + OSM")
  $bc=@($CARD,$INK,$AMB,$CYAN,$CARD,$CARD)
  $bt=@($WHT,$WHT,$BG,$BG,$WHT,$WHT)
  $px=@(28,340,652,28,340,652)
  $py=@(92,92,92,208,208,208)
  for($i=0;$i -lt 6;$i++){
    [void](BoxC $s $px[$i] $py[$i] 280 88 $bc[$i])
    [void](BoxT $s ($px[$i]+12) ($py[$i]+26) 256 40 $bx[$i] 15 $bt[$i] $true 2)
  }

  [void](BoxC $s 28 312 904 40 $INK)
  [void](BoxT $s 40 318 880 28 "Browser -> Vercel API -> Groq + MiniLM + Supabase. Map runs in the browser. Cost: Rs 0." 13 $SOFT $false 1)

  [void](BoxC $s 28 364 300 120 $CARD)
  [void](BoxT $s 44 372 268 18 "APP" 12 $AMB $true 1)
  [void](BoxT $s 44 394 268 80 ("Next.js + TypeScript + Tailwind" + $nl + "Hosted on Vercel Hobby") 13 $SOFT $false 1)
  [void](BoxC $s 344 364 300 120 $CARD)
  [void](BoxT $s 360 372 268 18 "DATA" 12 $CYAN $true 1)
  [void](BoxT $s 360 394 268 80 ("Supabase Postgres + Storage" + $nl + "Auth for admin only") 13 $SOFT $false 1)
  [void](BoxC $s 660 364 276 120 $CARD)
  [void](BoxT $s 676 372 244 18 "INTELLIGENCE" 12 $GRN $true 1)
  [void](BoxT $s 676 394 244 80 ("Groq Llama + MiniLM" + $nl + "Web Speech API") 13 $SOFT $false 1)
  Foot $s 6
  Note $s "If they ask cost: every box is a free tier. If they ask scale: Supabase + Vercel is enough for a campus. If they ask why no FastAPI: one app is more reliable on demo day."

  # ============================================================
  # 07 DEMO
  # ============================================================
  $s=NewS $pres
  [void](BoxR $s 0 0 8 540 $AMB)
  [void](BoxT $s 28 16 900 16 "06  LIVE DEMO  |  90 SECONDS" 12 $AMB $true 1)
  [void](BoxT $s 24 40 900 36 "We will switch to the app after this slide." 24 $WHT $true 1)

  $h1=@("MAP IS LIVE","ME TOO","NEW REPORT","ADMIN CLOSES IT")
  $h2=@(
    "25 seeded issues already on the map. Campus health starts at 72. Library is worse.",
    "Tap Library Wi-Fi. Affected count jumps. Priority jumps. Nobody writes a second report.",
    "Hostel B Wi-Fi. Prompt: already exists? AI returns Wi-Fi / IT / high in about 2 seconds.",
    "On it, 2 hour ETA, resolve. Health goes 72 to 75. Response trail updates."
  )
  $hc=@($AMB,$CYAN,$WHT,$GRN)
  for($i=0;$i -lt 4;$i++){
    $yy=88+($i*78)
    [void](BoxC $s 24 $yy 912 70 $CARD)
    [void](BoxR $s 24 $yy 8 70 $hc[$i])
    [void](BoxT $s 48 ($yy+10) 64 48 ("0"+($i+1)) 20 $hc[$i] $true 1)
    [void](BoxT $s 118 ($yy+8) 230 52 $h1[$i] 15 $WHT $true 1)
    [void](BoxT $s 360 ($yy+16) 556 42 $h2[$i] 13 $SOFT $false 1)
  }

  [void](BoxT $s 28 410 900 22 "BACKUP IF THE LLM IS DOWN" 12 $RED $true 1)
  [void](BoxT $s 28 436 900 50 "Keyword fallback still creates the ticket and drops the pin. Me too never calls the model. Demo cannot die on Wi-Fi." 14 $SOFT $false 1)
  Foot $s 7
  Note $s "Say: we will now open the live app. Do not talk over the clicks. 1 map, 2 Me too, 3 new report, 4 admin resolve. If Groq spins, submit anyway and say fallback. Then come back here for close."

  # ============================================================
  # 08 CLOSE
  # ============================================================
  $s=NewS $pres
  [void](BoxR $s 0 0 8 540 $AMB)
  [void](BoxT $s 28 16 900 16 "07  WHY THIS IS NOT A GOOGLE FORM" 12 $AMB $true 1)
  [void](BoxT $s 22 44 920 56 "One leak. One job." 40 $WHT $true 1)
  [void](BoxT $s 28 108 900 28 "Students get a voice. Admin gets a queue. Campus gets a number." 16 $SOFT $false 1)

  [void](BoxC $s 24 156 296 180 $CARD)
  [void](BoxT $s 40 170 264 24 "SAFETY FIRST" 14 $AMB $true 1)
  [void](BoxT $s 40 206 264 110 ("A lock does not beat an electrical hazard. The 40-25-20-15 formula is public.") 14 $SOFT $false 1)
  [void](BoxC $s 332 156 296 180 $CARD)
  [void](BoxT $s 348 170 264 24 "SAME MAP" 14 $CYAN $true 1)
  [void](BoxT $s 348 206 264 110 ("Student and admin see the same pins. No private black box. Shared accountability.") 14 $SOFT $false 1)
  [void](BoxC $s 640 156 296 180 $CARD)
  [void](BoxT $s 656 170 264 24 "WE MEASURE" 14 $GRN $true 1)
  [void](BoxT $s 656 206 264 110 ("Avg assign time and avg resolve time sit on the admin home. Admin can see if they are slow.") 14 $SOFT $false 1)

  [void](BoxR $s 24 356 912 134 $AMB)
  [void](BoxT $s 44 372 872 36 "No account. No name. Just the issue." 24 $BG $true 1)
  [void](BoxT $s 44 416 872 28 "Thank you. Questions?" 20 $BG $true 1)
  [void](BoxT $s 44 452 872 24 "Team CampusPulse  |  Edit names on slide 1" 14 $BG $false 1)
  [void](BoxT $s 24 508 400 20 "CAMPUSPULSE AI  |  HACKATHON PRESENTATION" 10 $DIM $true 1)
  [void](BoxT $s 840 508 90 20 "08 / 08" 10 $DIM $false 3)
  Note $s "End on the yellow bar. Do not add future IoT unless asked. If asked what is next: longer history, QR posters, Hindi. If asked privacy: no identity fields, EXIF stripped, photos can still identify someone."

  $out="d:\Ankiii\CampusPulse_AI_Hackathon_Presentation.pptx"
  if(Test-Path $out){ Remove-Item $out -Force }
  $pres.SaveAs($out,24)
  Write-Output "SAVED $out $($pres.Slides.Count)"
}
finally {
  if($pres){ $pres.Close(); [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($pres) }
  if($ppt){ $ppt.Quit(); [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) }
  [GC]::Collect(); [GC]::WaitForPendingFinalizers()
}
