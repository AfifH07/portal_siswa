document.addEventListener('DOMContentLoaded', function() {

    // Fetch dashboard data
    async function loadDashboardData() {
        try {
            // Example API call - adjust endpoints as needed
            const token = localStorage.getItem('access_token');
            
            if (token) {
                // Fetch attendance data
                // const attendanceResponse = await fetch('/api/attendance/', {
                //     headers: {
                //         'Authorization': `Bearer ${token}`
                //     }
                // });
                // const attendanceData = await attendanceResponse.json();
                // document.getElementById('attendance-stat').textContent = attendanceData.length || '0';

                // Fetch grades data
                // const gradesResponse = await fetch('/api/grades/', {
                //     headers: {
                //         'Authorization': `Bearer ${token}`
                //     }
                // });
                // const gradesData = await gradesResponse.json();
                // const avgGrade = gradesData.length > 0 
                //     ? (gradesData.reduce((sum, g) => sum + g.score, 0) / gradesData.length).toFixed(2)
                //     : '-';
                // document.getElementById('grade-stat').textContent = avgGrade;

                // Fetch evaluations data
                // const evaluationsResponse = await fetch('/api/evaluations/', {
                //     headers: {
                //         'Authorization': `Bearer ${token}`
                //     }
                // });
                // const evaluationsData = await evaluationsResponse.json();
                // document.getElementById('evaluation-stat').textContent = evaluationsData.length || '0';
            }

            // Set placeholder values for demo
            document.getElementById('attendance-stat').textContent = 'Loading...';
            document.getElementById('grade-stat').textContent = 'Loading...';
            document.getElementById('evaluation-stat').textContent = 'Loading...';

        } catch (error) {
            console.error('Error loading dashboard data:', error);
        }
    }

    // Load data on page load
    loadDashboardData();
});