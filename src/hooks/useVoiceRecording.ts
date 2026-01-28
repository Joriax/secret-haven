import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface VoiceNote {
  id: string;
  title: string;
  filename: string;
  duration: number;
  transcript?: string;
  isFavorite: boolean;
  folderId?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export function useVoiceRecording() {
  const { userId, supabaseClient: supabase } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;
    
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
    setAudioLevel(average / 255);
    
    if (isRecording && !isPaused) {
      animationRef.current = requestAnimationFrame(updateAudioLevel);
    }
  }, [isRecording, isPaused]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });

      // Setup audio analyser for visualization
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mediaRecorder = new MediaRecorder(stream, { 
        mimeType: 'audio/webm;codecs=opus' 
      });
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      setIsPaused(false);
      setDuration(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);

      // Start audio level updates
      updateAudioLevel();

    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  }, [updateAudioLevel]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);
      updateAudioLevel();
    }
  }, [updateAudioLevel]);

  const stopRecording = useCallback((): Promise<Blob> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current) {
        resolve(new Blob());
        return;
      }

      if (timerRef.current) clearInterval(timerRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        chunksRef.current = [];
        
        // Stop all tracks
        mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
        
        setIsRecording(false);
        setIsPaused(false);
        setAudioLevel(0);
        resolve(blob);
      };

      mediaRecorderRef.current.stop();
    });
  }, []);

  const cancelRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      mediaRecorderRef.current.stop();
    }
    
    chunksRef.current = [];
    setIsRecording(false);
    setIsPaused(false);
    setDuration(0);
    setAudioLevel(0);
  }, []);

  // Transcribe audio using Web Speech API
  const transcribe = useCallback(async (audioBlob: Blob): Promise<string | null> => {
    // Web Speech API is not reliable for file transcription
    // Return null for now - could integrate with external API
    return null;
  }, []);

  // Save voice note to database and storage
  const saveVoiceNote = useCallback(async (
    audioBlob: Blob, 
    title: string = '', 
    options?: { folderId?: string; transcript?: string }
  ): Promise<VoiceNote | null> => {
    if (!userId) return null;

    try {
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.webm`;
      const storagePath = `${userId}/${filename}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('voice-notes')
        .upload(storagePath, audioBlob, { contentType: 'audio/webm' });

      if (uploadError) throw uploadError;

      // Save to database
      const { data, error } = await supabase
        .from('voice_notes')
        .insert({
          user_id: userId,
          title: title || `Aufnahme ${new Date().toLocaleString('de-DE')}`,
          filename,
          duration,
          transcript: options?.transcript || null,
          folder_id: options?.folderId || null,
        })
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        title: data.title,
        filename: data.filename,
        duration: data.duration,
        transcript: data.transcript || undefined,
        isFavorite: data.is_favorite,
        folderId: data.folder_id || undefined,
        tags: data.tags || [],
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        deletedAt: data.deleted_at || undefined,
      };
    } catch (error) {
      console.error('Error saving voice note:', error);
      return null;
    }
  }, [userId, supabase, duration]);

  return {
    isRecording,
    isPaused,
    duration,
    audioLevel,
    isTranscribing,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    cancelRecording,
    transcribe,
    saveVoiceNote,
  };
}
