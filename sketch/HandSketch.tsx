import dynamic from "next/dynamic";
import p5Types from "p5";
import { MutableRefObject, useRef } from "react";
import { Hand } from "@tensorflow-models/hand-pose-detection";
import { getSmoothedHandpose } from "../lib/getSmoothedHandpose";
import { updateHandposeHistory } from "../lib/updateHandposeHistory";
import { Keypoint } from "@tensorflow-models/hand-pose-detection";
import { convertHandToHandpose } from "../lib/converter/convertHandToHandpose";
import { isFront } from "../lib/calculator/isFront";
import { Monitor } from "../components/Monitor";
import { Recorder } from "../components/Recorder";
import Matter from "matter-js";

type Props = {
  handpose: MutableRefObject<Hand[]>;
};

let leftHand: Keypoint[] = [];
let rightHand: Keypoint[] = [];

type Handpose = Keypoint[];

const Sketch = dynamic(import("react-p5"), {
  loading: () => <></>,
  ssr: false,
});

export const HandSketch = ({ handpose }: Props) => {
  let handposeHistory: {
    left: Handpose[];
    right: Handpose[];
  } = { left: [], right: [] };
  const circleSize = 80;

  // module aliases
  let Engine = Matter.Engine,
    Bodies = Matter.Bodies,
    Composite = Matter.Composite;
  const floors: Matter.Body[] = [];
  for (let i = 0; i < 10; i++) {
    floors.push(
      Bodies.rectangle(
        (window.innerWidth / 10) * i + window.innerWidth / 10 / 2,
        (window.innerHeight / 3) * 2,
        window.innerWidth / 10,
        1,
        { isStatic: true }
      )
    );
  }
  const circle = Bodies.circle(window.innerWidth / 2, -1000, circleSize);

  // create an engine
  let engine: Matter.Engine;

  const debugLog = useRef<{ label: string; value: any }[]>([]);

  const preload = (p5: p5Types) => {
    // 画像などのロードを行う
  };

  const setup = (p5: p5Types, canvasParentRef: Element) => {
    p5.createCanvas(p5.windowWidth, p5.windowHeight).parent(canvasParentRef);
    p5.stroke(220);
    p5.fill(255);
    p5.strokeWeight(10);
    engine = Engine.create();

    Composite.add(engine.world, [circle, ...floors]);
  };

  const draw = (p5: p5Types) => {
    const rawHands: {
      left: Handpose;
      right: Handpose;
    } = convertHandToHandpose(handpose.current);
    handposeHistory = updateHandposeHistory(rawHands, handposeHistory); //handposeHistoryの更新
    const hands: {
      left: Handpose;
      right: Handpose;
    } = getSmoothedHandpose(rawHands, handposeHistory); //平滑化された手指の動きを取得する

    // logとしてmonitorに表示する
    debugLog.current = [];
    for (const hand of handpose.current) {
      debugLog.current.push({
        label: hand.handedness + " accuracy",
        value: hand.score,
      });
      debugLog.current.push({
        label: hand.handedness + " is front",
        //@ts-ignore
        value: isFront(hand.keypoints, hand.handedness.toLowerCase()),
      });
    }

    p5.clear();
    p5.noStroke();
    p5.rectMode(p5.CENTER);

    if (hands.left.length > 0) {
      leftHand = hands.left;
    } else {
      leftHand = [];
    }

    if (leftHand.length > 0) {
      for (let i = 0; i < 5; i++) {
        const d = Math.max(leftHand[4 * i + 1].y - leftHand[4 * i + 4].y, 0);
        Matter.Body.setPosition(
          floors[i],
          {
            x: floors[i].position.x,
            y: (window.innerHeight / 3) * 2 - d,
          }, //@ts-ignore
          true
        );
      }
    }

    for (let i = 0; i < 5; i++) {
      p5.rect(
        floors[i].position.x,
        floors[i].position.y,
        p5.width / 10,
        10,
        50
      );
    }

    if (hands.right.length > 0) {
      rightHand = hands.right;
    } else {
      rightHand = [];
    }

    if (rightHand.length > 0) {
      for (let i = 0; i < 5; i++) {
        const d = Math.max(rightHand[4 * i + 1].y - rightHand[4 * i + 4].y, 0);
        Matter.Body.setPosition(
          floors[i + 5],
          {
            x: floors[i + 5].position.x,
            y: (window.innerHeight / 3) * 2 - d,
          }, //@ts-ignore
          true
        );
      }
    }
    for (let i = 0; i < 5; i++) {
      p5.rect(
        floors[i + 5].position.x,
        floors[i + 5].position.y,
        p5.width / 10,
        10,
        50
      );
    }

    Engine.update(engine);
    p5.circle(circle.position.x, circle.position.y, circleSize * 2);
  };

  const windowResized = (p5: p5Types) => {
    p5.resizeCanvas(p5.windowWidth, p5.windowHeight);
  };

  return (
    <>
      <Monitor handpose={handpose} debugLog={debugLog} />
      <Recorder handpose={handpose} />
      <Sketch
        preload={preload}
        setup={setup}
        draw={draw}
        windowResized={windowResized}
      />
    </>
  );
};
