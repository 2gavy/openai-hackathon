import { useEffect, useRef, useCallback, useState } from 'react';

import { RealtimeClient } from '@openai/realtime-api-beta';
import { ItemType } from '@openai/realtime-api-beta/dist/lib/client.js';
const { OpenAI } = require("openai");

import { WavRecorder, WavStreamPlayer } from '../lib/wavtools/index.js';
import { instructions } from '../utils/conversation_medical.js';

import { X } from 'react-feather';
import { WavRenderer } from '../utils/wav_renderer';

import './ConsolePage.scss';
import CallingScreenInIPhoneX from './CallingScreenInIPhoneX';
import CallComponent from './CallComponent';
import FinalReport from './FinalReport';

/**
 * Type for result from get_weather() function call
 */
interface Coordinates {
  lat: number;
  lng: number;
  location?: string;
  temperature?: {
    value: number;
    units: string;
  };
  wind_speed?: {
    value: number;
    units: string;
  };
}

/**
 * Type for all event logs
 */
interface RealtimeEvent {
  time: string;
  source: 'client' | 'server';
  count?: number;
  event: { [key: string]: any };
}

export function ConsolePage() {
  /**
   * Ask user for API Key
   * If we're using the local relay server, we don't need this
   */
  const apiKey = localStorage.getItem('tmp::voice_api_key') || prompt('OpenAI API Key') || '';
  if (apiKey !== '') {
    localStorage.setItem('tmp::voice_api_key', apiKey);
  }

  /**
   * Instantiate:
   * - WavRecorder (speech input)
   * - WavStreamPlayer (speech output)
   * - RealtimeClient (API client)
   */
  const wavRecorderRef = useRef<WavRecorder>(
    new WavRecorder({ sampleRate: 24000 })
  );
  const wavStreamPlayerRef = useRef<WavStreamPlayer>(
    new WavStreamPlayer({ sampleRate: 24000 })
  );
  const clientRef = useRef<RealtimeClient>(
    new RealtimeClient({
      apiKey: apiKey,
      dangerouslyAllowAPIKeyInBrowser: true,
    }
    )
  );

  /**
   * References for
   * - Rendering audio visualization (canvas)
   * - Autoscrolling event logs
   * - Timing delta for event log displays
   */
  const clientCanvasRef = useRef<HTMLCanvasElement>(null);
  const serverCanvasRef = useRef<HTMLCanvasElement>(null);
  const eventsScrollHeightRef = useRef(0);
  const eventsScrollRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<string>(new Date().toISOString());

  var updatedInstructions = "";

  /**
   * All of our variables for displaying application state
   * - items are all conversation items (dialog)
   * - realtimeEvents are event logs, which can be expanded
   * - memoryKv is for set_memory() function
   * - coords, marker are for get_weather() function
   */
  const [items, setItems] = useState<ItemType[]>([]);
  const [realtimeEvents, setRealtimeEvents] = useState<RealtimeEvent[]>([]);
  const [expandedEvents, setExpandedEvents] = useState<{
    [key: string]: boolean;
  }>({});
  const [isConnected, setIsConnected] = useState(false);
  const [canPushToTalk, setCanPushToTalk] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [memoryKv, setMemoryKv] = useState<{ [key: string]: any }>({});
  const [coords, setCoords] = useState<Coordinates | null>({
    lat: 37.775593,
    lng: -122.418137,
  });
  const [marker, setMarker] = useState<Coordinates | null>(null);

  /**
   * Utility for formatting the timing of logs
   */
  const formatTime = useCallback((timestamp: string) => {
    const startTime = startTimeRef.current;
    const t0 = new Date(startTime).valueOf();
    const t1 = new Date(timestamp).valueOf();
    const delta = t1 - t0;
    const hs = Math.floor(delta / 10) % 100;
    const s = Math.floor(delta / 1000) % 60;
    const m = Math.floor(delta / 60_000) % 60;
    const pad = (n: number) => {
      let s = n + '';
      while (s.length < 2) {
        s = '0' + s;
      }
      return s;
    };
    return `${pad(m)}:${pad(s)}.${pad(hs)}`;
  }, []);

  const openai = new OpenAI({
    apiKey: localStorage.getItem('tmp::voice_api_key'), dangerouslyAllowBrowser: true
  });

  const testConversation = useCallback(async () => {  }, []);

    /**
   * Connect to conversation:
   * WavRecorder taks speech input, WavStreamPlayer output, client is API client
   */
  const connectConversation = useCallback(async () => {
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    const wavStreamPlayer = wavStreamPlayerRef.current;

    // Set state variables
    startTimeRef.current = new Date().toISOString();
    setIsConnected(true);
    setRealtimeEvents([]);
    setItems(client.conversation.getItems());

    // Connect to microphone
    await wavRecorder.begin();

    // Connect to audio output
    await wavStreamPlayer.connect();

    // Connect to realtime API
    await client.connect();

    client.sendUserMessageContent([
      {
        type: `input_text`,
        text: `Hello! I'm your caregiver assistant, how can I help you today? Please tell me the patient you are caring for.`,
      },
    ]);

    if (client.getTurnDetectionType() === 'server_vad') {
      await wavRecorder.record((data) => client.appendInputAudio(data.mono));
    }
  }, []);

  /**
   * Disconnect and reset conversation state
   */
  const disconnectConversation = useCallback(async () => {
    setIsConnected(false);
    setRealtimeEvents([]);
    setItems([]);
    setMemoryKv({});
    setMarker(null);

    const client = clientRef.current;
    client.disconnect();

    const wavRecorder = wavRecorderRef.current;
    await wavRecorder.end();

    const wavStreamPlayer = wavStreamPlayerRef.current;
    await wavStreamPlayer.interrupt();
  }, []);

  const deleteConversationItem = useCallback(async (id: string) => {
    const client = clientRef.current;
    client.deleteItem(id);
  }, []);

  /**
   * In push-to-talk mode, start recording
   * .appendInputAudio() for each sample
   */
  const startRecording = async () => {
    setIsRecording(true);
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    const wavStreamPlayer = wavStreamPlayerRef.current;
    const trackSampleOffset = await wavStreamPlayer.interrupt();
    if (trackSampleOffset?.trackId) {
      const { trackId, offset } = trackSampleOffset;
      await client.cancelResponse(trackId, offset);
    }
    await wavRecorder.record((data) => client.appendInputAudio(data.mono));
  };

  /**
   * In push-to-talk mode, stop recording
   */
  const stopRecording = async () => {
    setIsRecording(false);
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    await wavRecorder.pause();
    client.createResponse();
  };

  const conversationRef = useRef(null);
  /**
   * Auto-scroll the conversation logs
   */
  useEffect(() => {
    // Function to scroll to the bottom
    const scrollToBottom = () => {
      if (conversationRef.current) {
        (conversationRef.current as HTMLDivElement).scrollTop = (conversationRef.current as HTMLDivElement).scrollHeight;
      }
    };

    // Using requestAnimationFrame to ensure scroll happens after the DOM is updated
    requestAnimationFrame(scrollToBottom);
  }, [items]); // Runs when items change

  /**
 * Set up render loops for the visualization canvas
 */
  useEffect(() => {
    let isLoaded = true;

    const wavRecorder = wavRecorderRef.current;
    const clientCanvas = clientCanvasRef.current;
    let clientCtx: CanvasRenderingContext2D | null = null;

    const wavStreamPlayer = wavStreamPlayerRef.current;
    const serverCanvas = serverCanvasRef.current;
    let serverCtx: CanvasRenderingContext2D | null = null;

    const render = () => {
      if (isLoaded) {
        if (clientCanvas) {
          if (!clientCanvas.width || !clientCanvas.height) {
            clientCanvas.width = clientCanvas.offsetWidth;
            clientCanvas.height = clientCanvas.offsetHeight;
          }
          clientCtx = clientCtx || clientCanvas.getContext('2d');
          if (clientCtx) {
            clientCtx.clearRect(0, 0, clientCanvas.width, clientCanvas.height);
            const result = wavRecorder.recording
              ? wavRecorder.getFrequencies('voice')
              : { values: new Float32Array([0]) };
            WavRenderer.drawBars(
              clientCanvas,
              clientCtx,
              result.values,
              '#0099ff',
              10,
              0,
              8
            );
          }
        }
        if (serverCanvas) {
          if (!serverCanvas.width || !serverCanvas.height) {
            serverCanvas.width = serverCanvas.offsetWidth;
            serverCanvas.height = serverCanvas.offsetHeight;
          }
          serverCtx = serverCtx || serverCanvas.getContext('2d');
          if (serverCtx) {
            serverCtx.clearRect(0, 0, serverCanvas.width, serverCanvas.height);
            const result = wavStreamPlayer.analyser
              ? wavStreamPlayer.getFrequencies('voice')
              : { values: new Float32Array([0]) };
            WavRenderer.drawBars(
              serverCanvas,
              serverCtx,
              result.values,
              '#009900',
              10,
              0,
              8
            );
          }
        }
        window.requestAnimationFrame(render);
      }
    };
    render();

    return () => {
      isLoaded = false;
    };
  }, []);

  /**
   * Core RealtimeClient and audio capture setup
   * Set all of our instructions, tools, events and more
   */
  useEffect(() => {
    // Get refs
    const wavStreamPlayer = wavStreamPlayerRef.current;
    const client = clientRef.current;

    // Set instructions
    client.updateSession({ instructions: instructions });
    // Set transcription, otherwise we don't get user transcriptions back
    client.updateSession({ input_audio_transcription: { model: 'whisper-1' } });

    // Add Weather
    client.addTool(
      {
        name: 'get_weather',
        description:
          'Retrieves the weather for a given lat, lng coordinate pair. Specify a label for the location.',
        parameters: {
          type: 'object',
          properties: {
            lat: {
              type: 'number',
              description: 'Latitude',
            },
            lng: {
              type: 'number',
              description: 'Longitude',
            },
            location: {
              type: 'string',
              description: 'Name of the location',
            },
          },
          required: ['lat', 'lng', 'location'],
        },
      },
      async ({ lat, lng, location }: { [key: string]: any }) => {
        setMarker({ lat, lng, location });
        setCoords({ lat, lng, location });
        const result = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,wind_speed_10m`
        );
        const json = await result.json();
        const temperature = {
          value: json.current.temperature_2m as number,
          units: json.current_units.temperature_2m as string,
        };
        const wind_speed = {
          value: json.current.wind_speed_10m as number,
          units: json.current_units.wind_speed_10m as string,
        };
        setMarker({ lat, lng, location, temperature, wind_speed });
        return json;
      }
    );

    const knowledgeBase = [
      "When the patient reports feeling breathless -> Position them upright or slightly forward and encourage pursed-lip breathing - inhale through nose and exhale slowly through pursed lips",

      "When patient is breathless and appears anxious or panicked -> Help them stay calm through reassurance and guided breathing. Panic can worsen breathing difficulties",

      "When patient is having difficulty breathing while lying down -> Use pillows to prop them up in elevated position. This positioning can make breathing easier",

      "If you observe rapid breathing, bluish lips/fingertips, confusion, or extreme fatigue -> Contact healthcare providers immediately as these are signs of severe respiratory distress",

      "When planning daily activities with the patient -> Schedule regular rest periods between tasks and avoid rushing. Break activities into smaller, manageable steps",

      "If the patient is interested in exercise -> Start with very light activity only if approved by doctor. Monitor breathing during exercise",

      "During episodes of breathlessness -> Note when they occur and what seems to trigger or relieve them to identify patterns",

      "When setting up the patient's environment -> Keep medications like inhalers within easy reach. Ensure room is well-ventilated and cool",

      "If breathlessness occurs during hot or humid weather -> Use air conditioning or fans to improve air circulation and comfort",

      "When planning meals -> Offer small, frequent meals rather than large ones to avoid pressing on the diaphragm",

      "If breathlessness suddenly worsens or is accompanied by chest pain -> Contact healthcare providers immediately",

      "When oxygen therapy is prescribed -> Ensure proper understanding of equipment use and maintenance before starting",

      "When maintaining the living space -> Keep area free from dust, strong smells, and irritants that could trigger breathing difficulties",

      "If caregiver or patient needs additional support -> Consider joining support groups for advice and emotional support",

      "When monitoring symptoms -> Maintain clear communication with healthcare team about any changes in breathing patterns",

      "When starting new medications -> Monitor carefully for drowsiness or other side effects that could affect breathing"
    ];

    // Calculate Levenshtein distance between two strings
    function levenshteinDistance(str1: string, str2: string) {
      const m = str1.length;
      const n = str2.length;
      const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

      for (let i = 0; i <= m; i++) dp[i][0] = i;
      for (let j = 0; j <= n; j++) dp[0][j] = j;

      for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
          if (str1[i - 1] === str2[j - 1]) {
            dp[i][j] = dp[i - 1][j - 1];
          } else {
            dp[i][j] = Math.min(
              dp[i - 1][j - 1] + 1,
              dp[i - 1][j] + 1,
              dp[i][j - 1] + 1
            );
          }
        }
      }
      return dp[m][n];
    }



    // Check if a word approximately matches any word in the target string
    function fuzzyWordMatch(searchWord: string, targetString: string, threshold = 0.7) {
      const targetWords = targetString.toLowerCase().split(/\s+/);
      return targetWords.some(targetWord => {
        const distance = levenshteinDistance(searchWord.toLowerCase(), targetWord.toLowerCase());
        const maxLength = Math.max(searchWord.length, targetWord.length);
        const similarity = 1 - (distance / maxLength);
        return similarity >= threshold;
      });
    }

    client.addTool(
      {
        name: 'enrich_elastic_knowledge_base',
        description:
          'Do not generate summary! Enrich with Elastic Knowledge Base',
        parameters: {
          type: 'object',
          properties: {
            search_term: {
              type: 'string',
              description: 'Keywords, search terms, criteria to find recommended actions',
            }
          },
          required: ['search_term'],
        },
      },
      async ({ search_term }: { search_term: string }) => {
        const searchTerms = search_term.toLowerCase().split(/\s+/);
        const results = knowledgeBase.filter(item =>
          searchTerms.some(term => fuzzyWordMatch(term, item))
        );

        if (results.length === 0) {
          return "No relevant information found.";
        }

        // Sort results by relevance (number of matching terms)
        const scoredResults = results.map(item => ({
          text: item,
          score: searchTerms.filter(term => fuzzyWordMatch(term, item)).length
        }));

        scoredResults.sort((a, b) => b.score - a.score);
        return scoredResults.map(result => result.text).join('\n');
      }
    );

    client.addTool(
      {
        name: 'get_patient_profile',
        description:
          'Give me the patient name and summary, maximum 20 words. Ask what\'s wrong with him',
        parameters: {
          type: 'object',
          properties: {
            patient_id: {
              type: 'number',
              description: 'Patient ID',
            }
          },
          required: ['patient_id'],
        },
      },
      async ({ patient_id }: { patient_id: number }) => {
        return {
          "patientProfile": {
            "demographics": {
              "name": "Tan Ah Hock",
              "age": 68,
              "gender": "Male",
              "ethnicity": "Chinese",
              "occupation": "Retired Shipyard Worker",
              "geographicalLocation": "Singapore (Bukit Batok)"
            },
            "medicalHistory": {
              "primaryComplaint": [
                "Persistent cough",
                "Shortness of breath",
                "Unintended weight loss"
              ],
              "diagnosisDetails": {
                "type": "Non-Small Cell Lung Cancer (NSCLC)",
                "stage": "III",
                "molecularMarkers": ["EGFR positive"]
              },
              "comorbidities": ["Diabetes", "Hypertension"],
              "previousTreatments": ["Chemotherapy"]
            },
            "familyHistory": {
              "lungCancer": true,
              "otherCancers": false,
              "geneticPredispositions": null
            },
            "lifestyleAndSocialHistory": {
              "smokingHistory": {
                "status": "Former smoker",
                "packYears": 30,
                "quitDate": "2010-03-15"
              },
              "environmentalExposures": ["Asbestos", "Industrial chemicals"],
              "alcoholConsumption": "Light",
              "physicalActivityLevel": "Sedentary",
              "dietaryHabits": "Mostly traditional Asian diet, moderate intake of vegetables"
            },
            "psychosocialAndSupport": {
              "mentalHealthHistory": ["Moderate anxiety, post-diagnosis"],
              "supportSystem": ["Spouse", "Two adult children"],
              "economicFactors": {
                "insuranceCoverage": "MediShield Life and Integrated Shield Plan",
                "financialConstraints": "Some challenges with out-of-pocket expenses"
              }
            },
            "diagnosticWorkup": {
              "imagingResults": {
                "CTScan": "Mass in upper right lobe, 5.2 cm",
                "PETScan": "Increased uptake in regional lymph nodes"
              },
              "biopsyHistopathology": {
                "type": "Core needle biopsy",
                "results": "Adenocarcinoma"
              },
              "labTests": {
                "CBC": "Mild anemia",
                "LFTs": "Normal",
                "tumorMarkers": "Elevated CEA"
              }
            },
            "treatmentPlan": {
              "plannedInterventions": [
                "Targeted therapy with EGFR inhibitors",
                "Radiation therapy",
                "Ongoing symptom management"
              ],
              "clinicalTrials": "Enrolled in local trial for new EGFR-targeted drug",
              "palliativeCareNeeds": ["Pain management", "Nutritional support"]
            },
            "followUpAndMonitoring": {
              "frequency": "Bi-monthly",
              "imagingSchedule": "CT scans every 3 months",
              "monitoringForRecurrence": "Continuous"
            }
          }
        };
      }
    );

    // handle realtime events from client + server for event logging
    client.on('realtime.event', (realtimeEvent: RealtimeEvent) => {
      setRealtimeEvents((realtimeEvents) => {
        const lastEvent = realtimeEvents[realtimeEvents.length - 1];
        if (lastEvent?.event.type === realtimeEvent.event.type) {
          // if we receive multiple events in a row, aggregate them for display purposes
          lastEvent.count = (lastEvent.count || 0) + 1;
          return realtimeEvents.slice(0, -1).concat(lastEvent);
        } else {
          return realtimeEvents.concat(realtimeEvent);
        }
      });
    });
    client.on('error', (event: any) => console.error(event));
    client.on('conversation.interrupted', async () => {
      const trackSampleOffset = await wavStreamPlayer.interrupt();
      if (trackSampleOffset?.trackId) {
        const { trackId, offset } = trackSampleOffset;
        await client.cancelResponse(trackId, offset);
      }
    });
    client.on('conversation.updated', async ({ item, delta }: any) => {
      const items = client.conversation.getItems();
      if (delta?.audio) {
        wavStreamPlayer.add16BitPCM(delta.audio, item.id);
      }
      if (item.status === 'completed' && item.formatted.audio?.length) {
        const wavFile = await WavRecorder.decode(
          item.formatted.audio,
          24000,
          24000
        );
        item.formatted.file = wavFile;
        // console.log(item.formatted.transcript)
        // console.log(items);
      }
      if (item.formatted.transcript.includes("Patient Name:")) {
        setReportContent(item.formatted.transcript)
        // disconnectConversation()
      }

      setItems(items);
    });

    setItems(client.conversation.getItems());

    return () => {
      // cleanup; resets to defaults
      client.reset();
    };
  }, []);



  // Function to simulate begin the call
  const beginCall = async () => {
    setIsConnected(false);
    setRealtimeEvents([]);
    setItems([]);
    setMemoryKv({});
    setMarker(null);

    const client = clientRef.current;
    client.disconnect();

    const wavRecorder = wavRecorderRef.current;
    await wavRecorder.end();

    const wavStreamPlayer = wavStreamPlayerRef.current;
    await wavStreamPlayer.interrupt();
  };



  const [reportContent, setReportContent] = useState<string>('');

  /**
   * Render the application
   */
  return (
    <div data-component="ConsolePage">
      <div className="flex flex-col h-screen">
        <div className="content-main grid grid-cols-4 flex-grow flex-shrink overflow-hidden h-[calc(100vh-64px)]">
          <div className="col-span-1 bg-gray-100">
            <div className="flex flex-col h-screen">
              <div className="content-block events p-5">
                <div className="visualization flex">
                  <div className="visualization-entry client flex-1">
                    <canvas ref={clientCanvasRef} className="w-full h-full" />
                  </div>
                  <div className="visualization-entry server flex-1">
                    <canvas ref={serverCanvasRef} className="w-full h-full" />
                  </div>
                </div>
                <div className="content-block-title text-xl font-bold text-gray-800 mb-4">Events</div>
                <div className="content-block-body" ref={eventsScrollRef}>
                  {!realtimeEvents.length && `awaiting connection...`}
                </div>
              </div>
              <div className="content-block conversation p-4">
                <div className="content-block-title text-xl font-bold text-gray-800">Conversation</div>
              </div>
              <div ref={conversationRef} className="content-block conversation overflow-y-auto p-5 mb-14" >
                {!items.length && `awaiting connection...`}
                {items.map((conversationItem) => {
                  return (
                    <div className="conversation-item" key={conversationItem.id}>
                      <div className={`speaker ${conversationItem.role || ''}`}>
                        <div>{(conversationItem.role || conversationItem.type).replaceAll('_', ' ')}</div>
                        {conversationItem.type === 'function_call' && conversationItem.name === 'enrich_elastic_knowledge_base' && (
                          <ElasticIcon />
                        )}
                        {conversationItem.type === 'function_call' && conversationItem.name === 'get_patient_profile' && (
                          <HospitalIcon />
                        )}
                        <div className="close" onClick={() => deleteConversationItem(conversationItem.id)}>
                          <X />
                        </div>
                      </div>
                      <div className="speaker-content">
                        {/* Render conversation content here */}
                        {conversationItem.type === 'function_call_output' && (
                          <div>{conversationItem.formatted.output}</div>
                        )}
                        {!!conversationItem.formatted.tool && (
                          <div>
                            {conversationItem.formatted.tool.name}({conversationItem.formatted.tool.arguments})
                          </div>
                        )}
                        {!conversationItem.formatted.tool && conversationItem.role === 'user' && (
                          <div>
                            {conversationItem.formatted.transcript ||
                              (conversationItem.formatted.audio?.length
                                ? '(awaiting transcript)'
                                : conversationItem.formatted.text || '(item sent)')}
                          </div>
                        )}
                        {!conversationItem.formatted.tool && conversationItem.role === 'assistant' && (
                          <div>
                            {conversationItem.formatted.transcript || conversationItem.formatted.text || '(truncated)'}
                          </div>
                        )}
                        {conversationItem.formatted.file && (
                          <audio src={conversationItem.formatted.file.url} controls />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="col-span-2 bg-gray-300 relative flex justify-center items-center p-2">
            {/* Calling Screen Content */}
            <div className="relative z-10">
              {!isConnected && <CallComponent onButtonClick={connectConversation} />}
              {isConnected && canPushToTalk && (<CallingScreenInIPhoneX onButtonClick={disconnectConversation} isRecording={isRecording} startRecording={startRecording} stopRecording={stopRecording}  reportContent={reportContent}/>)}
            </div>
          </div>

          <div className="col-span-1 bg-gray-100">
            <div className="flex flex-col h-screen">
              <FinalReport reportContent={reportContent} />
            </div>
          </div>
        </div>
        {/* <div className="fixed bottom-0 left-0 w-full bg-gray-800 text-white p-4 text-center">
          Built by ZingZai, Wilson, Siu, Hann
        </div> */}
      </div>
    </div>
  );
}

const ElasticIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="25"
    height="25"
    viewBox="0 0 256 256"
    preserveAspectRatio="xMinYMin meet"
  >
    <path
      d="M255.96 134.393c0-21.521-13.373-40.117-33.223-47.43a75.239 75.239 0 0 0 1.253-13.791c0-39.909-32.386-72.295-72.295-72.295-23.193 0-44.923 11.074-58.505 30.088-6.686-5.224-14.835-7.94-23.402-7.94-21.104 0-38.446 17.133-38.446 38.446 0 4.597.836 9.194 2.298 13.373C13.582 81.739 0 100.962 0 122.274c0 21.522 13.373 40.327 33.431 47.64-.835 4.388-1.253 8.985-1.253 13.79 0 39.7 32.386 72.087 72.086 72.087 23.402 0 44.924-11.283 58.505-30.088 6.686 5.223 15.044 8.149 23.611 8.149 21.104 0 38.446-17.134 38.446-38.446 0-4.597-.836-9.194-2.298-13.373 19.64-7.104 33.431-26.327 33.431-47.64z"
      fill="#FFF"
    />
    <path
      d="M100.085 110.364l57.043 26.119 57.669-50.565a64.312 64.312 0 0 0 1.253-12.746c0-35.52-28.834-64.355-64.355-64.355-21.313 0-41.162 10.447-53.072 27.998l-9.612 49.73 11.074 23.82z"
      fill="#F4BD19"
    />
    <path
      d="M40.953 170.75c-.835 4.179-1.253 8.567-1.253 12.955 0 35.52 29.043 64.564 64.564 64.564 21.522 0 41.372-10.656 53.49-28.208l9.403-49.729-12.746-24.238-57.251-26.118-56.207 50.774z"
      fill="#3CBEB1"
    />
    <path
      d="M40.536 71.918l39.073 9.194 8.775-44.506c-5.432-4.179-11.91-6.268-18.805-6.268-16.925 0-30.924 13.79-30.924 30.924 0 3.552.627 7.313 1.88 10.656z"
      fill="#E9478C"
    />
    <path
      d="M37.192 81.32c-17.551 5.642-29.67 22.567-29.67 40.954 0 17.97 11.074 34.059 27.79 40.327l54.953-49.73-10.03-21.52-43.043-10.03z"
      fill="#2C458F"
    />
    <path
      d="M167.784 219.852c5.432 4.18 11.91 6.478 18.596 6.478 16.925 0 30.924-13.79 30.924-30.924 0-3.761-.627-7.314-1.88-10.657l-39.073-9.193-8.567 44.296z"
      fill="#95C63D"
    />
    <path
      d="M175.724 165.317l43.043 10.03c17.551-5.85 29.67-22.566 29.67-40.954 0-17.97-11.074-33.849-27.79-40.326l-56.415 49.311 11.492 21.94z"
      fill="#176655"
    />
  </svg>
);

const OpenaiIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="25"
    height="25"
    viewBox="-1 -.1 949.1 959.8"
  >
    <path d="M925.8 456.3c10.4 23.2 17 48 19.7 73.3 2.6 25.3 1.3 50.9-4.1 75.8-5.3 24.9-14.5 48.8-27.3 70.8-8.4 14.7-18.3 28.5-29.7 41.2-11.3 12.6-23.9 24-37.6 34-13.8 10-28.5 18.4-44.1 25.3-15.5 6.8-31.7 12-48.3 15.4-7.8 24.2-19.4 47.1-34.4 67.7-14.9 20.6-33 38.7-53.6 53.6-20.6 15-43.4 26.6-67.6 34.4-24.2 7.9-49.5 11.8-75 11.8-16.9.1-33.9-1.7-50.5-5.1-16.5-3.5-32.7-8.8-48.2-15.7s-30.2-15.5-43.9-25.5c-13.6-10-26.2-21.5-37.4-34.2-25 5.4-50.6 6.7-75.9 4.1-25.3-2.7-50.1-9.3-73.4-19.7-23.2-10.3-44.7-24.3-63.6-41.4s-35-37.1-47.7-59.1c-8.5-14.7-15.5-30.2-20.8-46.3s-8.8-32.7-10.6-49.6c-1.8-16.8-1.7-33.8.1-50.7 1.8-16.8 5.5-33.4 10.8-49.5-17-18.9-31-40.4-41.4-63.6-10.3-23.3-17-48-19.6-73.3-2.7-25.3-1.3-50.9 4-75.8s14.5-48.8 27.3-70.8c8.4-14.7 18.3-28.6 29.6-41.2s24-24 37.7-34 28.5-18.5 44-25.3c15.6-6.9 31.8-12 48.4-15.4 7.8-24.3 19.4-47.1 34.3-67.7 15-20.6 33.1-38.7 53.7-53.7 20.6-14.9 43.4-26.5 67.6-34.4 24.2-7.8 49.5-11.8 75-11.7 16.9-.1 33.9 1.6 50.5 5.1s32.8 8.7 48.3 15.6c15.5 7 30.2 15.5 43.9 25.5 13.7 10.1 26.3 21.5 37.5 34.2 24.9-5.3 50.5-6.6 75.8-4s50 9.3 73.3 19.6c23.2 10.4 44.7 24.3 63.6 41.4 18.9 17 35 36.9 47.7 59 8.5 14.6 15.5 30.1 20.8 46.3 5.3 16.1 8.9 32.7 10.6 49.6 1.8 16.9 1.8 33.9-.1 50.8-1.8 16.9-5.5 33.5-10.8 49.6 17.1 18.9 31 40.3 41.4 63.6z" />
  </svg>
);

const HospitalIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    xmlnsXlink="http://www.w3.org/1999/xlink"
    viewBox="0 0 512 512"
    width="25"
    height="25"
    xmlSpace="preserve"
  >
    <polygon style={{ fill: '#E4F1FB' }} points="409.6,238.933 409.6,0 102.4,0 102.4,238.933 25.6,238.933 25.6,512 102.4,512 409.6,512 486.4,512 486.4,238.933" />
    <polygon style={{ fill: '#C9E3F7' }} points="409.6,238.933 409.6,0 256,0 256,512 486.4,512 486.4,238.933" />
    <polygon style={{ fill: '#D80027' }} points="341.333,119.467 290.133,119.467 290.133,68.267 221.867,68.267 221.867,119.467 170.667,119.467 170.667,187.733 221.867,187.733 221.867,238.933 290.133,238.933 290.133,187.733 341.333,187.733" />
    <polygon style={{ fill: '#A2001D' }} points="290.133,119.467 290.133,68.267 256,68.267 256,238.933 290.133,238.933 290.133,187.733 341.333,187.733 341.333,119.467" />
    <rect x="128" y="409.6" style={{ fill: '#5A8BB0' }} width="256" height="102.4" />
    <rect x="256" y="409.6" style={{ fill: '#3C5D76' }} width="128" height="102.4" />
    <g>
      <rect x="332.8" y="307.2" style={{ fill: '#FFFFFF' }} width="51.2" height="51.2" />
      <rect x="230.4" y="307.2" style={{ fill: '#FFFFFF' }} width="51.2" height="51.2" />
      <rect x="119.467" y="307.2" style={{ fill: '#FFFFFF' }} width="51.2" height="51.2" />
      <rect x="17.067" y="307.2" style={{ fill: '#FFFFFF' }} width="59.733" height="51.2" />
      <rect x="17.067" y="409.6" style={{ fill: '#FFFFFF' }} width="59.733" height="51.2" />
      <rect x="435.2" y="409.6" style={{ fill: '#FFFFFF' }} width="59.733" height="51.2" />
      <rect x="435.2" y="307.2" style={{ fill: '#FFFFFF' }} width="59.733" height="51.2" />
    </g>
  </svg>
);