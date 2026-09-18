$ErrorActionPreference = "Stop"
function RGB([int]$r,[int]$g,[int]$b){ $r + ($g -shl 8) + ($b -shl 16) }

$BG    = RGB 8 8 10
$CARD  = RGB 18 18 22
$INK   = RGB 28 28 34
$AMB   = RGB 255 176 32
$CYAN  = RGB 80 230 220
$RED   = RGB 255 84 84
$GRN   = RGB 56 220 130
$WHT   = RGB 255 255 255
$SOFT  = RGB 220 220 226
$DIM   = RGB 140 140 150
$W=960; $H=540

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
  [void](BoxT $s 28 508 240 20 "CAMPUSPULSE AI" 10 $DIM $true 1)
  [void](BoxT $s 860 508 72 20 ("0$n / 06") 10 $DIM $false 3)
}

$n=[char]13+[char]10
$ppt=$null; $pres=$null
try{
  $ppt=New-Object -ComObject PowerPoint.Application
  $ppt.Visible=-1
  $pres=$ppt.Presentations.Add()
  $pres.PageSetup.SlideWidth=$W
  $pres.PageSetup.SlideHeight=$H

  # -------- 01 POSTER --------
  $s=NewS $pres
  [void](BoxR $s 0 0 960 8 $AMB)
  [void](BoxT $s 36 28 500 18 "HACKATHON PRODUCT   |   RS 0 STACK" 12 $CYAN $true 1)
  [void](BoxT $s 30 58 620 72 "CAMPUSPULSE AI" 44 $WHT $true 1)
  [void](BoxT $s 36 132 600 70 ("Campus repairs." + $n + "Run like a control room.") 28 $SOFT $false 1)

  [void](BoxC $s 36 230 186 88 $INK)
  [void](BoxT $s 48 240 162 28 "0" 26 $AMB $true 1)
  [void](BoxT $s 48 274 162 32 "student login" 13 $DIM $false 1)
  [void](BoxC $s 232 230 186 88 $INK)
  [void](BoxT $s 244 240 162 28 "25" 26 $CYAN $true 1)
  [void](BoxT $s 244 274 162 32 "seeded live issues" 13 $DIM $false 1)
  [void](BoxC $s 428 230 186 88 $INK)
  [void](BoxT $s 440 240 162 28 "2" 26 $WHT $true 1)
  [void](BoxT $s 440 274 162 32 "roles, one app" 13 $DIM $false 1)

  [void](BoxC $s 36 338 594 148 $CARD)
  [void](BoxT $s 52 352 560 28 "WhatsApp in. Ranked map out." 18 $WHT $true 1)
  [void](BoxT $s 52 390 560 80 ("Student drops a pin or taps Me too. AI tags danger and department. Same leak becomes one job. Admin fixes the hazard first.") 14 $SOFT $false 1)

  [void](BoxR $s 656 0 304 540 $AMB)
  [void](BoxT $s 676 50 264 18 "CAMPUS HEALTH" 12 $BG $true 1)
  [void](BoxT $s 672 86 272 110 "72" 90 $BG $true 1)
  [void](BoxT $s 676 200 264 24 "/ 100   seeded start" 14 $BG $false 1)
  [void](BoxT $s 676 260 264 90 ("After the live fix" + $n + "this number moves." + $n + "That is the demo.") 15 $BG $false 1)
  [void](BoxT $s 676 420 264 70 ("No name." + $n + "No account." + $n + "Just the issue.") 16 $BG $true 1)
  [void](BoxT $s 28 508 240 20 "CAMPUSPULSE AI" 10 $DIM $true 1)
  [void](BoxT $s 860 508 72 20 "01 / 06" 10 $DIM $false 3)

  # -------- 02 REAL MESS --------
  $s=NewS $pres
  [void](BoxR $s 0 0 8 540 $RED)
  [void](BoxT $s 28 18 900 16 "THE ACTUAL MESS  |  NOT A THEORY SLIDE" 12 $RED $true 1)
  [void](BoxT $s 24 42 900 40 "Work is real. System is a WhatsApp group." 26 $WHT $true 1)

  $x=@(28,328,628); $tag=@("CRITICAL","HIGH","LOST"); $tc=@($RED,$AMB,$DIM)
  $hd=@("Dark path, Hostel C","Library Wi-Fi dead","Broken chair, LH-2")
  $bd=@(
    "Night, no lights. Nobody filed. Hassle + fear.",
    "11 students stuck. 0 tickets. Someone else did.",
    "Told a staff member. Gone by evening."
  )
  for($i=0;$i -lt 3;$i++){
    [void](BoxC $s $x[$i] 100 292 150 $CARD)
    [void](BoxR $s $x[$i] 100 8 150 $tc[$i])
    [void](BoxT $s ($x[$i]+20) 110 256 18 $tag[$i] 11 $tc[$i] $true 1)
    [void](BoxT $s ($x[$i]+20) 132 256 36 $hd[$i] 16 $WHT $true 1)
    [void](BoxT $s ($x[$i]+20) 174 256 64 $bd[$i] 13 $SOFT $false 1)
  }

  [void](BoxT $s 28 268 900 22 "Because of that, admin is flying blind:" 14 $AMB $true 1)
  $k=@("NO TRACK","NO RANK","DUPES","NO TRAIL","FEAR")
  $v=@(
    "Student cannot see if anyone started.",
    "Lock is fixed. Wire hazard waits.",
    "Same leak in 8 chats. Or zero reports.",
    "No clue what dies every month.",
    "Name on a complaint. They stay quiet."
  )
  for($i=0;$i -lt 5;$i++){
    $xx=28+($i*186)
    [void](BoxC $s $xx 300 176 186 $CARD)
    [void](BoxT $s ($xx+10) 312 156 36 $k[$i] 13 $AMB $true 1)
    [void](BoxT $s ($xx+10) 356 156 110 $v[$i] 13 $SOFT $false 1)
  }
  Foot $s 2

  # -------- 03 PRODUCT --------
  $s=NewS $pres
  [void](BoxR $s 0 0 8 540 $CYAN)
  [void](BoxT $s 28 16 500 16 "WHAT THE APP IS" 12 $CYAN $true 1)
  [void](BoxT $s 24 38 500 36 "A campus ops desk. Not a form." 22 $WHT $true 1)

  $st=@("01  PIN / ME TOO","02  AI TAGS IT","03  MERGE","04  SAFETY QUEUE","05  FIX + PROOF")
  $sd=@(
    "Map pin, voice or text. Or one tap on an existing pin.",
    "Category, danger 1-5, department. Groq or keyword backup.",
    "Same place + same meaning = one cluster. Impact rises.",
    "40% safety, 25% people, 20% wait, 15% place.",
    "On it, ETA, after-photo. Times are stored."
  )
  for($i=0;$i -lt 5;$i++){
    $yy=88+($i*76)
    [void](BoxC $s 24 $yy 500 68 $CARD)
    [void](BoxT $s 40 ($yy+6) 468 24 $st[$i] 14 $AMB $true 1)
    [void](BoxT $s 40 ($yy+32) 468 30 $sd[$i] 12 $SOFT $false 1)
  }

  [void](BoxC $s 544 88 392 400 $CARD)
  [void](BoxT $s 560 100 240 18 "LIVE MAP  (demo)" 12 $CYAN $true 1)
  [void](BoxT $s 800 100 120 18 "18 OPEN" 12 $AMB $true 3)
  [void](BoxC $s 560 128 360 210 $INK)
  $dots=@(
    @(30,24,$RED),@(90,50,$AMB),@(180,30,$RED),@(250,70,$GRN),
    @(60,110,$CYAN),@(150,100,$AMB),@(240,130,$RED),@(300,40,$GRN),
    @(110,160,$AMB),@(200,170,$GRN),@(40,170,$RED)
  )
  foreach($d in $dots){ [void](BoxO $s (570+$d[0]) (140+$d[1]) 14 $d[2]) }
  [void](BoxT $s 576 300 320 22 "Hostel B Wi-Fi  x6 merged" 12 $WHT $true 1)

  [void](BoxC $s 560 352 112 116 $INK)
  [void](BoxT $s 568 360 96 16 "HEALTH" 10 $DIM $true 1)
  [void](BoxT $s 568 380 96 50 "72" 28 $AMB $true 1)
  [void](BoxC $s 684 352 112 116 $INK)
  [void](BoxT $s 692 360 96 16 "CRITICAL" 10 $DIM $true 1)
  [void](BoxT $s 692 380 96 50 "4" 28 $RED $true 1)
  [void](BoxC $s 808 352 112 116 $INK)
  [void](BoxT $s 816 360 96 16 "AVG FIX" 10 $DIM $true 1)
  [void](BoxT $s 816 380 96 50 "19h" 24 $CYAN $true 1)
  Foot $s 3

  # -------- 04 BUILD LIST --------
  $s=NewS $pres
  [void](BoxR $s 0 0 8 540 $AMB)
  [void](BoxT $s 28 14 900 16 "WHAT WE IMPLEMENT THIS WEEKEND" 12 $AMB $true 1)
  [void](BoxT $s 24 36 900 32 "Code. Not a vision board." 24 $WHT $true 1)

  $rowsL=@(
    "Anonymous report: pin + text + photo",
    "Browser voice. No Whisper server.",
    "Me too on an open pin",
    "Already exists? prompt before submit",
    "Ticket + public map status",
    "Building health on the map"
  )
  $rowsR=@(
    "Groq: category, severity, department",
    "MiniLM: merge nearby duplicates",
    "Admin queue + On it + ETA",
    "Resolve proof photo",
    "Avg assign time + avg resolve time",
    "Hotspot if 3 hits in 14 days"
  )
  [void](BoxC $s 24 84 456 300 $CARD)
  [void](BoxT $s 40 94 420 20 "STUDENT  |  NO LOGIN" 13 $CYAN $true 1)
  [void](BoxC $s 492 84 444 300 $CARD)
  [void](BoxT $s 508 94 412 20 "ADMIN + AI  |  ONE LOGIN" 13 $CYAN $true 1)
  for($i=0;$i -lt 6;$i++){
    $yy=124+($i*40)
    [void](BoxO $s 44 $yy 10 $AMB)
    [void](BoxT $s 64 ($yy-6) 400 28 $rowsL[$i] 13 $SOFT $false 1)
    [void](BoxO $s 512 $yy 10 $CYAN)
    [void](BoxT $s 532 ($yy-6) 388 28 $rowsR[$i] 13 $SOFT $false 1)
  }

  [void](BoxC $s 24 396 912 100 $INK)
  [void](BoxT $s 40 406 880 18 "PRIORITY FORMULA  (locked, not a black box)" 12 $AMB $true 1)
  [void](BoxT $s 40 436 880 44 "40% SAFETY    +    25% AFFECTED PEOPLE    +    20% WAIT TIME    +    15% LOCATION" 16 $WHT $true 1)
  Foot $s 4

  # -------- 05 DEMO --------
  $s=NewS $pres
  [void](BoxR $s 0 0 8 540 $GRN)
  [void](BoxT $s 28 14 900 16 "THE 90-SECOND DEMO  |  THIS IS THE PRODUCT" 12 $GRN $true 1)
  [void](BoxT $s 24 36 900 32 "Four clicks. Score moves. That is it." 24 $WHT $true 1)

  $h1=@("MAP IS LIVE","ME TOO","NEW REPORT","ADMIN ENDS IT")
  $h2=@(
    "25 real-looking issues already on the map. Health starts at 72. Library is worse.",
    "Tap Library Wi-Fi. Affected count jumps. Priority jumps. Nobody types a second essay.",
    "Hostel B Wi-Fi. Prompt: already exists? AI returns Wi-Fi / IT / high in 2 seconds.",
    "On it, 2 hour ETA, resolve. Health 72 -> 75. Response trail updates."
  )
  $hc=@($AMB,$CYAN,$WHT,$GRN)
  for($i=0;$i -lt 4;$i++){
    $yy=86+($i*80)
    [void](BoxC $s 24 $yy 912 72 $CARD)
    [void](BoxR $s 24 $yy 8 72 $hc[$i])
    [void](BoxT $s 48 ($yy+8) 70 52 ("0"+($i+1)) 22 $hc[$i] $true 1)
    [void](BoxT $s 120 ($yy+8) 240 52 $h1[$i] 16 $WHT $true 1)
    [void](BoxT $s 370 ($yy+16) 540 44 $h2[$i] 13 $SOFT $false 1)
  }

  [void](BoxT $s 28 416 900 18 "STACK  |  ONE NEXT.JS APP  |  NO GPU  |  NO SECOND BACKEND" 12 $AMB $true 1)
  [void](BoxT $s 28 444 900 24 "Next.js + Tailwind   Vercel   Supabase   Leaflet/OSM   Groq Llama   MiniLM" 15 $WHT $false 1)
  [void](BoxT $s 28 476 900 22 "If Groq is down, keywords still file the ticket. Me too never needs AI. Demo cannot die." 13 $DIM $false 1)
  Foot $s 5

  # -------- 06 CLOSE --------
  $s=NewS $pres
  [void](BoxR $s 0 0 8 540 $AMB)
  [void](BoxT $s 28 16 900 16 "THE LINE YOU SAY AT THE END" 12 $AMB $true 1)
  [void](BoxT $s 22 44 920 70 "One leak. One job." 48 $WHT $true 1)
  [void](BoxT $s 28 122 900 28 "Not 10 WhatsApp messages. Not a Google Form." 18 $SOFT $false 1)

  [void](BoxC $s 24 172 296 196 $CARD)
  [void](BoxT $s 40 186 264 24 "SAFETY FIRST" 14 $AMB $true 1)
  [void](BoxT $s 40 222 264 120 ("A lock does not beat" + $n + "an electrical hazard." + $n + "The formula is public.") 14 $SOFT $false 1)
  [void](BoxC $s 332 172 296 196 $CARD)
  [void](BoxT $s 348 186 264 24 "SAME MAP" 14 $AMB $true 1)
  [void](BoxT $s 348 222 264 120 ("Student and admin see" + $n + "the same pins." + $n + "No private black box.") 14 $SOFT $false 1)
  [void](BoxC $s 640 172 296 196 $CARD)
  [void](BoxT $s 656 186 264 24 "WE MEASURE" 14 $AMB $true 1)
  [void](BoxT $s 656 222 264 120 ("Avg assign time and" + $n + "avg resolve time sit" + $n + "on the admin home.") 14 $SOFT $false 1)

  [void](BoxR $s 24 388 912 108 $AMB)
  [void](BoxT $s 44 404 872 36 "No account. No name. Just the issue." 24 $BG $true 1)
  [void](BoxT $s 44 448 872 28 "Then the fix. Then 72 becomes 75." 16 $BG $false 1)
  [void](BoxT $s 28 508 240 20 "CAMPUSPULSE AI" 10 $DIM $true 1)
  [void](BoxT $s 860 508 72 20 "06 / 06" 10 $DIM $false 3)

  $out="d:\Ankiii\CampusPulse_AI_Pitch.pptx"
  if(Test-Path $out){ Remove-Item $out -Force }
  $pres.SaveAs($out,24)
  Write-Output "SAVED $out $($pres.Slides.Count)"
} finally {
  if($pres){ $pres.Close(); [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($pres) }
  if($ppt){ $ppt.Quit(); [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) }
  [GC]::Collect(); [GC]::WaitForPendingFinalizers()
}
