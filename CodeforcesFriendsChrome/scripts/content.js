async function init(handles) {
    // Check if extension is enabled
    const extensionState = await new Promise((resolve) => {
        chrome.storage.local.get('extensionEnabled', (result) => {
            resolve(result.extensionEnabled !== undefined ? result.extensionEnabled : true);
        });
    });
    
    if (!extensionState) {
        // Remove friends table if extension is disabled
        const existingTable = document.querySelector('#friends-submissions-table');
        if (existingTable) {
            existingTable.remove();
        }
        return;
    }

    let friendsTableDiv = document.querySelector('#friends-submissions-table');
    if (!friendsTableDiv) {
        friendsTableDiv = document.createElement('div');
        friendsTableDiv.id = 'friends-submissions-table';
        friendsTableDiv.className = 'roundbox sidebox top-contributed borderTopRound ';
        const tableCaptionDiv = friendsTableDiv.appendChild(document.createElement('div'));
        tableCaptionDiv.className = 'caption titled';
        tableCaptionDiv.innerHTML = "Friends' Submissions";
        const tableDiv = friendsTableDiv.appendChild(document.createElement('table'));
        tableDiv.className = 'rtable ';
        tableDiv.appendChild(document.createElement('tbody'));
        const el1 = document.querySelector("#sidebar > div:nth-child(1)");
        el1.insertAdjacentElement('afterend', friendsTableDiv);
    }

    
    const tableBody = friendsTableDiv.querySelector('table > tbody');
    tableBody.innerHTML = ''; 

    const baseURL = "https://codeforces.com/api/";
    
    const ratingsMap = new Map([
        ['newbie', 'rated-user user-gray'],
        ['pupil', 'rated-user user-green'],
        ['specialist', 'rated-user user-cyan'],
        ['expert', 'rated-user user-blue'],
        ['candidate master', 'rated-user user-violet'],
        ['master', 'rated-user user-orange'],
        ['international master', 'rated-user user-orange'],
        ['grandmaster', 'rated-user user-red'],
        ['international grandmaster', 'rated-user user-red'],
        ['legendary grandmaster', 'rated-user user-legendary']
    ]);

    const verdictMap = new Map([
        ['OK', '✅'],  
        ['WRONG_ANSWER', '❌'], 
        ['TIME_LIMIT_EXCEEDED', '⌛'],  
        ['MEMORY_LIMIT_EXCEEDED', '💡'],  
        ['DEFAULT', '⚠️'] 
    ]);

    const getEmoji = (verdict) => verdictMap.get(verdict) ?? verdictMap.get('DEFAULT');


    const problemPage = window.location.href;
    function extractIntegersFromString(inputString) {
        // Match all sequences of digits (\d+)
        const regex = /\d+/g;
        const matches = inputString.match(regex);
    
        if (matches) {
            // Join the matched numbers into a single string
            return matches.join('');
        } else {
            return ''; // No integers found
        }
    }

    function getProblemIndexFromUrl(url) {
        // Remove any trailing slashes from the URL
        const cleanedUrl = url.replace(/\/+$/, '');

        const match = cleanedUrl.match(/\/problem\/([A-Z]\d*)/);
        
        if (match) {
            return match[1]; // Return the full problem index (A, B, C1, D2, etc.)
        }
        
        // Fallback: get the last segment after the last slash
        const lastSegment = cleanedUrl.split('/').pop();
        return lastSegment;
    }

    const contestNumber = parseInt(extractIntegersFromString(problemPage));
    const contestProblem = getProblemIndexFromUrl(problemPage);
    let handleCount = 0;
    
    
    for (let handle of handles) {
        try {
            
            const infoUrl = `${baseURL}user.info?handles=${handle}`;
            const infoResponse = await fetch(infoUrl);
            if (!infoResponse.ok) {
                throw new Error('Network response was not ok');
            }
            const infoBody = await infoResponse.json();
            const rating = infoBody.result[0].rank;

            
            const statusUrl = `${baseURL}user.status?handle=${handle}&from=1`;
            const statusResponse = await fetch(statusUrl);
            if (!statusResponse.ok) {
                throw new Error('Network response was not ok');
            }
            const responseBody = await statusResponse.json();
            const submissionsCount = 10000;

            
            // Find all submissions for the current problem
            const problemSubmissions = [];
            for (let i = 0; i < submissionsCount; i++) {
                if (responseBody.result[i] && 
                    responseBody.result[i].problem.contestId == contestNumber && 
                    responseBody.result[i].problem.index.localeCompare(contestProblem) == 0) {
                    problemSubmissions.push(responseBody.result[i]);
                }
            }

            if (problemSubmissions.length > 0) {
                // Find the latest AC submission, or latest submission if no AC
                let selectedSubmission = problemSubmissions[0]; // Default to latest submission
                
                for (let submission of problemSubmissions) {
                    if (submission.verdict === 'OK') {
                        selectedSubmission = submission;
                        break; // Take the latest AC submission (first AC in the list since it's sorted by time desc)
                    }
                }

                handleCount++;
                const submissionTime = selectedSubmission.creationTimeSeconds * 1000;
                const dateObj = new Date(submissionTime);
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const formattedTime = `${monthNames[dateObj.getMonth()]}/${dateObj.getDate()}/${dateObj.getFullYear()} ${dateObj.toLocaleTimeString()}<sup title="timezone offset" style="font-size:8px;"> UTC${(dateObj.getTimezoneOffset() / -60).toFixed(1)}</sup>`;
                const tableRowElement = document.createElement("tr");
                const isOdd = handleCount % 2 !== 0;

                tableRowElement.innerHTML = `
                    <td class="left ${isOdd ? 'dark' : ''}">
                        <a class="${ratingsMap.get(rating)}" href="/profile/${handle}">${handle}</a>
                    </td>
                    <td class="${isOdd ? 'dark' : ''}">
                        <a href="https://codeforces.com/contest/${selectedSubmission.problem.contestId}/submission/${selectedSubmission.id}">
                            <div style="display: flex; align-items: center;">
                                <span style="flex-grow: 1;">View Solution</span>
                                <span>${getEmoji(selectedSubmission.verdict)}</span>
                            </div>
                        </a>
                    </td>
                    <td class="status-small ${isOdd ? 'dark' : ''}">
                        ${formattedTime}
                    </td>
                `;
                tableBody.appendChild(tableRowElement);
            }
        } catch (error) {
            console.error('Error:', error);
        }
    }
}

async function getHandles() {
    try {
        const result = await new Promise((resolve, reject) => {
            chrome.storage.local.get('userHandles', (result) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError.message);
                } else {
                    resolve(result.userHandles);
                }
            });
        });

        if (result) {
            await init(result);
        } else {
            init([]);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

getHandles();


chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local') {
        // Handle userHandles changes
        if (changes.hasOwnProperty('userHandles')) {
            const newHandles = changes['userHandles'].newValue;
            if (newHandles) {
                init(newHandles);
            } else {
                init([]);
            }
        }
        
        // Handle extension toggle changes
        if (changes.hasOwnProperty('extensionEnabled')) {
            chrome.storage.local.get('userHandles', function (result) {
                let userHandles = result.userHandles || [];
                init(userHandles);
            });
        }
    }
});
