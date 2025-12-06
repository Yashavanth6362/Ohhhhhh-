import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  analyser: AnalyserNode | null;
  isActive: boolean;
  barColor?: string;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ 
  analyser, 
  isActive,
  barColor = '#4facfe'
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = canvas.parentElement?.clientWidth || 300;
      canvas.height = canvas.parentElement?.clientHeight || 150;
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const dataArray = analyser ? new Uint8Array(analyser.frequencyBinCount) : new Uint8Array(0);

    const render = () => {
      if (!isActive) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw a flat line when inactive
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 2;
        ctx.stroke();
        return;
      }

      if (analyser) {
        analyser.getByteFrequencyData(dataArray);
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / dataArray.length) * 2.5;
      let barHeight;
      let x = 0;

      // Draw mirrored spectrum
      const centerY = canvas.height / 2;

      for (let i = 0; i < dataArray.length; i++) {
        barHeight = (dataArray[i] / 255) * (canvas.height / 2); // Scale to half height

        // Add glow effect
        ctx.shadowBlur = 10;
        ctx.shadowColor = barColor;

        ctx.fillStyle = barColor;
        
        // Draw top half
        ctx.fillRect(x, centerY - barHeight, barWidth, barHeight);
        
        // Draw bottom half (reflection)
        ctx.fillStyle = `${barColor}80`; // slightly transparent
        ctx.fillRect(x, centerY, barWidth, barHeight);

        x += barWidth + 1;
      }
      
      ctx.shadowBlur = 0; // Reset shadow
      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [analyser, isActive, barColor]);

  return (
    <div className="w-full h-full flex items-center justify-center bg-gray-900/50 rounded-xl overflow-hidden border border-gray-700 backdrop-blur-sm">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};

export default AudioVisualizer;