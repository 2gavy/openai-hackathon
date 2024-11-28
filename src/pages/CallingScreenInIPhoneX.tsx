import React, { useState } from 'react';
import { DeviceFrameset } from 'react-device-frameset'
import 'react-device-frameset/styles/marvel-devices.min.css'

interface CallingScreenInIPhoneXProps {
    onButtonClick: () => Promise<void>; // Or `() => void` depending on your implementation
    isRecording: boolean;
    reportContent: string;
    startRecording?: () => void;
    stopRecording?: () => void;
}

const CallingScreenInIPhoneX: React.FC<CallingScreenInIPhoneXProps> = ({ onButtonClick, isRecording, startRecording, stopRecording, reportContent }) => {
    React.useEffect(() => {
        // Remove the 'notch' class after the component has mounted
        const notchElement = document.querySelector('.notch');
        if (notchElement) {
            notchElement.classList.remove('notch');
        }
    }, []);

    const [callDuration, setCallDuration] = useState(0);

    // State to simulate call status
    const [isCallActive, setIsCallActive] = useState(true);

    React.useEffect(() => {
        const timer = setInterval(() => setCallDuration((prev) => prev + 1), 1000);
        return () => clearInterval(timer);
    }, []);

    const formatTime = (duration: number) => {
        const minutes = Math.floor(duration / 60)
            .toString()
            .padStart(2, '0');
        const seconds = (duration % 60).toString().padStart(2, '0');
        return `${minutes}:${seconds}`;
    };

    return (
        <DeviceFrameset device="iPhone X" color="black">
            <div className="flex items-center justify-center relative">
                <div className="relative w-[375px] h-[812px] bg-gradient-to-b from-[#6d4d3e] to-[#4b2d25] rounded-3xl shadow-lg text-white overflow-hidden z-20">

                    <div className="absolute top-3 left-1/2 transform -translate-x-1/2 w-24 h-6 bg-black rounded-full flex items-center justify-center">
                        <div className="w-20 h-4 bg-gray-800 rounded-full">
                            <div className="flex items-center justify-between w-full h-full px-1">
                                <div className="w-2 h-2 bg-gray-900 rounded-full"></div> {/* Camera hole */}
                            </div>
                        </div>
                    </div>

                    {/* Header with calling information */}
                    <div className="text-center mt-10">
                        <p className="text-sm text-gray-300 pt-10">Calling mobile...</p>
                        <h1 className="text-2xl font-bold mt-1">Caring Assistant</h1>
                        <p className="text-sm text-gray-300 mt-2">{formatTime(callDuration)}</p>
                    </div>

                    {/* Button grid */}
                    <div className="absolute bottom-28 w-full px-8 grid grid-cols-3 gap-y-6 text-center">
                        <Button label="Speaker" icon={SpeakerIcon} />
                        <Button label="FaceTime" icon={FaceTimeIcon} />
                        <Button
                            label={isRecording ? 'Release to Send' : 'Push to Talk'}
                            icon={isRecording ? ReleaseToSendIcon : PushtotalkIcon}
                            startRecording={startRecording}
                            stopRecording={stopRecording}
                        />
                        <Button label="Add" icon={AddIcon} />
                        <Button label="End Call" icon={EndIcon} isEnd={true} handleClick={onButtonClick} />
                        <Button
                            label={reportContent ? 'Send to email' : 'Keypad'}
                            icon={reportContent ? SendMailIcon : KeypadIcon}
                        />
                        {/* <Button label="Keypad" icon={KeypadIcon} /> */}
                    </div>
                </div>
            </div>
        </DeviceFrameset>
    );
};

const Button: React.FC<{
    label: string;
    icon: React.FC;
    isEnd?: boolean;
    handleClick?: () => void;
    isHidden?: boolean;
    startRecording?: () => void;
    stopRecording?: () => void;
}> = ({
    label,
    icon: Icon,
    isEnd,
    handleClick,
    isHidden = false,
    startRecording,
    stopRecording
}) => (
        <button
            className={`flex flex-col items-center justify-center text-white ${isHidden ? 'hidden' : ''}`}
            onClick={handleClick}
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
        >
            <div className={`w-16 h-16 ${isEnd ? 'bg-[#c0392b]' : 'bg-[#6e5242]'} rounded-full flex items-center justify-center`}>
                <Icon />
            </div>
            <p className="mt-3 text-sm">{label}</p>
        </button>
    );




const SpeakerIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" > {/* Speaker box */}
        <path d="M11 5L6 9H3v6h3l5 4V5z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} /> {/* Sound waves */}
        <path d="M15.5 8.5c1.5 1.5 1.5 5.5 0 7m3-10c3 3 3 11 0 14" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
    </svg>
);

const FaceTimeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="#000000" width="40px" height="40px" viewBox="0 0 24 24" id="facetime" data-name="Flat Color" className="icon flat-color" > <path id="secondary" d="M21.12,7.34a2,2,0,0,0-1.86-.2L15.63,8.6a1,1,0,0,0-.63.92v5a1,1,0,0,0,.63.92l3.63,1.46A2.11,2.11,0,0,0,20,17a2,2,0,0,0,1.12-.34A2,2,0,0,0,22,15V9A2,2,0,0,0,21.12,7.34Z" style={{ fill: 'rgb(44, 169, 188)' }} /> <rect id="primary" x="3" y="5" width="15" height="14" rx="3" style={{ fill: 'white' }} /> </svg>
);

const PushtotalkIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" fill="#FFFFFF" height="30px" width="30px" version="1.1" viewBox="0 0 512 512" enableBackground="new 0 0 512 512">
        <g>
            <g>
                <path d="m439.5,236c0-11.3-9.1-20.4-20.4-20.4s-20.4,9.1-20.4,20.4c0,70-64,126.9-142.7,126.9-78.7,0-142.7-56.9-142.7-126.9 0-11.3-9.1-20.4-20.4-20.4s-20.4,9.1-20.4,20.4c0,86.2 71.5,157.4 163.1,166.7v57.5h-23.6c-11.3,0-20.4,9.1-20.4,20.4 0,11.3 9.1,20.4 20.4,20.4h88c11.3,0 20.4-9.1 20.4-20.4 0-11.3-9.1-20.4-20.4-20.4h-23.6v-57.5c91.6-9.3 163.1-80.5 163.1-166.7z" />
                <path d="m256,323.5c51,0 92.3-41.3 92.3-92.3v-127.9c0-51-41.3-92.3-92.3-92.3s-92.3,41.3-92.3,92.3v127.9c0,51 41.3,92.3 92.3,92.3zm-52.3-220.2c0-28.8 23.5-52.3 52.3-52.3s52.3,23.5 52.3,52.3v127.9c0,28.8-23.5,52.3-52.3,52.3s-52.3-23.5-52.3-52.3v-127.9z" />
            </g>
        </g>
    </svg>
);

const ReleaseToSendIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="30px" height="30px" viewBox="0 0 24 24" fill="#90EE90">
        <path d="M20.7639 12H10.0556M3 8.00003H5.5M4 12H5.5M4.5 16H5.5M9.96153 12.4896L9.07002 15.4486C8.73252 16.5688 8.56376 17.1289 8.70734 17.4633C8.83199 17.7537 9.08656 17.9681 9.39391 18.0415C9.74792 18.1261 10.2711 17.8645 11.3175 17.3413L19.1378 13.4311C20.059 12.9705 20.5197 12.7402 20.6675 12.4285C20.7961 12.1573 20.7961 11.8427 20.6675 11.5715C20.5197 11.2598 20.059 11.0295 19.1378 10.5689L11.3068 6.65342C10.2633 6.13168 9.74156 5.87081 9.38789 5.95502C9.0808 6.02815 8.82627 6.24198 8.70128 6.53184C8.55731 6.86569 8.72427 7.42461 9.05819 8.54246L9.96261 11.5701C10.0137 11.7411 10.0392 11.8266 10.0493 11.9137C10.0583 11.991 10.0582 12.069 10.049 12.1463C10.0387 12.2334 10.013 12.3188 9.96153 12.4896Z" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);


const AddIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
);

const EndIcon = () => (
    <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" fill="currentColor" >
            <path d="M6.62 10.79a15.05 15.05 0 006.69 6.69l1.81-1.82a1 1 0 011.1-.23 11.66 11.66 0 003.61.61 1 1 0 011 1v3.59a1 1 0 01-.91 1A19.34 19.34 0 013 5.91a1 1 0 011-.91H7.6a1 1 0 011 1 11.66 11.66 0 00.61 3.61 1 1 0 01-.24 1.1z" />
        </svg>
    </div>
);

const KeypadIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="35px" height="35px" viewBox="0 0 64 64" fill="none" stroke="#ffffff" className="pr-1" >
        <circle cx="15" cy="13" r="5" fill="white" />
        <circle cx="15" cy="51" r="5" fill="white" />
        <circle cx="15" cy="32" r="5" fill="white" />
        <circle cx="53" cy="13" r="5" fill="white" />
        <circle cx="53" cy="51" r="5" fill="white" />
        <circle cx="53" cy="32" r="5" fill="white" />
        <circle cx="34" cy="13" r="5" fill="white" />
        <circle cx="34" cy="51" r="5" fill="white" />
        <circle cx="34" cy="32" r="5" fill="white" />
    </svg>
);

const SendMailIcon = () => (
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

export default CallingScreenInIPhoneX;
