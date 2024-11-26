import React, { useState } from 'react';
import { DeviceFrameset } from 'react-device-frameset'
import 'react-device-frameset/styles/marvel-devices.min.css'

interface CallComponentProps {
    onButtonClick: () => Promise<void>; // Or `() => void` depending on your implementation
}

const CallComponent: React.FC<CallComponentProps> = ({ onButtonClick }) => {
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
                        <h1 className="text-2xl font-bold pt-12">Caring Assistant</h1>
                    </div>

                    {/* Button grid */}
                    <div className="absolute bottom-28 w-full px-8 grid grid-cols-3 gap-y-6 text-center">
                        <div className="col-span-3 flex justify-center">  {/* Centers the content */}
                            <Button label="Call" icon={EndIcon} isEnd={true} handleClick={onButtonClick} />
                        </div>
                    </div>

                </div>
            </div>
        </DeviceFrameset>
    );
};

const Button: React.FC<{ label: string; icon: React.FC; isEnd?: boolean; handleClick?: () => void; }> = ({ label, icon: Icon, isEnd, handleClick }) => (
    <button className="flex flex-col items-center justify-center text-white" onClick={handleClick}>
        <div className={`w-16 h-16 ${isEnd ? 'bg-green-600' : 'bg-green-600'} rounded-full flex items-center justify-center`}>
            <Icon />
        </div>
        <p className="mt-3 text-sm">{label}</p>
    </button>
);

const EndIcon = () => (
    <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center">
        <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-6 h-6 text-white"
            fill="currentColor"
        >
            <path d="M6.62 10.79a15.05 15.05 0 006.69 6.69l1.81-1.82a1 1 0 011.1-.23 11.66 11.66 0 003.61.61 1 1 0 011 1v3.59a1 1 0 01-.91 1A19.34 19.34 0 013 5.91a1 1 0 011-.91H7.6a1 1 0 011 1 11.66 11.66 0 00.61 3.61 1 1 0 01-.24 1.1z" />
        </svg>
    </div>
);


export default CallComponent;
