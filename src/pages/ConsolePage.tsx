import { useEffect, useRef, useCallback, useState } from 'react';

import { RealtimeClient } from '@openai/realtime-api-beta';
import { ItemType } from '@openai/realtime-api-beta/dist/lib/client.js';
const { OpenAI } = require("openai");

import { WavRecorder, WavStreamPlayer } from '../lib/wavtools/index.js';
import { instructions } from '../utils/conversation_medical.js';
//import { instructions2 } from '../utils/conversation_medical2.js';

import { X, Edit, Zap, ArrowUp, ArrowDown } from 'react-feather';
import { Button } from '../components/button/Button';

import './ConsolePage.scss';
import { isJsxOpeningLikeElement } from 'typescript';

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
        text: `Hello!`,
        // text: `For testing purposes, I want you to list ten car brands. Number each item, e.g. "one (or whatever number you are one): the item name".`
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
    setCoords({
      lat: 37.775593,
      lng: -122.418137,
    });
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

  /**
   * Auto-scroll the event logs
   */
  // useEffect(() => {
  //   if (eventsScrollRef.current) {
  //     const eventsEl = eventsScrollRef.current;
  //     const scrollHeight = eventsEl.scrollHeight;
  //     // Only scroll if height has just changed
  //     if (scrollHeight !== eventsScrollHeightRef.current) {
  //       eventsEl.scrollTop = scrollHeight;
  //       eventsScrollHeightRef.current = scrollHeight;
  //     }
  //   }
  // }, [realtimeEvents]);

  /**
   * Auto-scroll the conversation logs
   */
  // useEffect(() => {
  //   const conversationEls = [].slice.call(
  //     document.body.querySelectorAll('[data-conversation-content]')
  //   );
  //   for (const el of conversationEls) {
  //     const conversationEl = el as HTMLDivElement;
  //     conversationEl.scrollTop = conversationEl.scrollHeight;
  //   }
  // }, [items]);

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
        name: 'search_caregiver_action_recommender',
        description:
          'Search for recommended actions based on criteria for patient caregiving. Must be called for decision-making purposes. Ask 1 more question.',
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
          'Retrieves the profile of a patient. Possible to return patient not found. Just give me 1 short summary. 50 words maximum. Ask me 2 follow-up questions.',
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

        console.log(items);
        if (items.length > 8) {
          console.log(updatedInstructions);
          updatedInstructions = "Speak faster. Now you are a medical expert professional who based on the knowledge and discovery answers you know and collected, give me a solution and recommendation what I should do now as a caregiver. \n\n";
          client.updateSession({ instructions: updatedInstructions });
        }
      }

      setItems(items);
    });

    setItems(client.conversation.getItems());

    return () => {
      // cleanup; resets to defaults
      client.reset();
    };
  }, []);

  /**
   * Render the application
   */
  return (
    <div data-component="ConsolePage">
      <div className="content-top">
        <div className="content-title">
          <img src="/openai-logomark.svg" />
          <span>OpenAI Hackathon</span>
        </div>
      </div>
      <div className="content-main">
        <div>
          <img src="assistant.gif" alt="Description of GIF" />
        </div>
        <div className="content-logs">
          <div className="content-block conversation">
            <div className="content-block-title">conversation</div>
            <div className="content-block-body" data-conversation-content>
              {!items.length && `awaiting connection...`}
              {items.map((conversationItem, i) => {
                return (
                  <div className="conversation-item" key={conversationItem.id}>
                    <div className={`speaker ${conversationItem.role || ''}`}>
                      <div>
                        {(
                          conversationItem.role || conversationItem.type
                        ).replaceAll('_', ' ')}
                      </div>
                      <div
                        className="close"
                        onClick={() =>
                          deleteConversationItem(conversationItem.id)
                        }
                      >
                        <X />
                      </div>
                    </div>
                    <div className={`speaker-content`}>
                      {/* tool response */}
                      {conversationItem.type === 'function_call_output' && (
                        <div>{conversationItem.formatted.output}</div>
                      )}
                      {/* tool call */}
                      {!!conversationItem.formatted.tool && (
                        <div>
                          {conversationItem.formatted.tool.name}(
                          {conversationItem.formatted.tool.arguments})
                        </div>
                      )}
                      {!conversationItem.formatted.tool &&
                        conversationItem.role === 'user' && (
                          <div>
                            {conversationItem.formatted.transcript ||
                              (conversationItem.formatted.audio?.length
                                ? '(awaiting transcript)'
                                : conversationItem.formatted.text ||
                                '(item sent)')}
                          </div>
                        )}
                      {!conversationItem.formatted.tool &&
                        conversationItem.role === 'assistant' && (
                          <div>
                            {conversationItem.formatted.transcript ||
                              conversationItem.formatted.text ||
                              '(truncated)'}
                          </div>
                        )}
                      {conversationItem.formatted.file && (
                        <audio
                          src={conversationItem.formatted.file.url}
                          controls
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="content-actions">
            <div className="spacer" />
            {isConnected && canPushToTalk && (
              <Button
                label={isRecording ? 'release to send' : 'push to talk'}
                buttonStyle={isRecording ? 'alert' : 'regular'}
                disabled={!isConnected || !canPushToTalk}
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
              />
            )}
            <div className="spacer" />
            <Button
              label={isConnected ? 'disconnect' : 'connect'}
              iconPosition={isConnected ? 'end' : 'start'}
              icon={isConnected ? X : Zap}
              buttonStyle={isConnected ? 'regular' : 'action'}
              onClick={
                isConnected ? disconnectConversation : connectConversation
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
